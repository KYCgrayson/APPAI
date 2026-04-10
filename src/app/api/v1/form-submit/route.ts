import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formSectionDataSchema, type FormSectionData } from "@/lib/validations/form-section";

// Very small in-memory rate limiter: N submissions per IP per window.
// This resets on every server restart, which is fine for a soft abuse
// deterrent. Swap for Upstash Redis if it becomes insufficient.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const ipHits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= RATE_LIMIT) {
    return { ok: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count += 1;
  return { ok: true };
}

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/**
 * Look up the FormSection config on the referenced page. Returns the
 * validated form data (so the server trusts our own stored schema, not
 * whatever the client claims the form looks like).
 */
async function findFormSection(
  slug: string,
  locale: string,
  parentSlug: string | null,
  sectionOrder: number | undefined,
): Promise<FormSectionData | null> {
  const page = await db.hostedPage.findFirst({
    where: {
      slug,
      locale,
      parentSlug,
      isPublished: true,
    },
    select: { content: true },
  });
  if (!page) return null;
  const sections = (page.content as { sections?: Array<{ type: string; order?: number; data: unknown }> } | null)?.sections;
  if (!Array.isArray(sections)) return null;
  const forms = sections.filter((s) => s.type === "form");
  if (forms.length === 0) return null;
  const target = sectionOrder !== undefined
    ? forms.find((s) => s.order === sectionOrder) ?? forms[0]
    : forms[0];
  const parsed = formSectionDataSchema.safeParse(target.data);
  if (!parsed.success) return null;
  return parsed.data;
}

function cleanValue(v: unknown): string {
  if (typeof v !== "string") return "";
  // Strip control chars, cap length, trim.
  return v.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 5000).trim();
}

function renderPlainBody(
  form: FormSectionData,
  values: Record<string, string>,
  meta: { pageSlug: string; parentSlug: string | null; locale: string; ip: string },
): string {
  const lines: string[] = [];
  lines.push(`New form submission from appai.info`);
  lines.push(``);
  lines.push(`Page: /${meta.parentSlug ? `${meta.parentSlug}/` : ""}${meta.pageSlug} (${meta.locale})`);
  lines.push(`IP:   ${meta.ip}`);
  lines.push(`Form: ${form.heading ?? "(untitled)"}`);
  lines.push(``);
  for (const f of form.fields) {
    lines.push(`${f.label}: ${values[f.name] ?? ""}`);
  }
  return lines.join("\n");
}

async function deliverMailto(
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.FORM_FROM_EMAIL || "forms@appai.info";
  if (!resendKey) {
    return {
      ok: false,
      error:
        "Email delivery is not configured on this platform instance (set RESEND_API_KEY). Use a webhook submitTo instead, or contact the platform operator.",
    };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `Email relay failed: ${res.status} ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    return { ok: false, error: `Email relay error: ${msg}` };
  }
}

async function deliverWebhook(
  url: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "appai.info/form-relay" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `Webhook returned HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    return { ok: false, error: `Webhook delivery failed: ${msg}` };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * POST /api/v1/form-submit
 *
 * Public, unauthenticated endpoint. Takes a form submission from a
 * hosted page's Form section, validates the destination against the
 * stored page config, and relays the submission to either a mailto:
 * or an https:// webhook. We never persist submissions to our DB.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = rateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many submissions. Try again in ${Math.ceil(limit.retryAfterMs / 1000)} seconds.` },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const {
    pageSlug,
    parentSlug,
    locale,
    sectionOrder,
    fields,
  } = (body ?? {}) as {
    pageSlug?: unknown;
    parentSlug?: unknown;
    locale?: unknown;
    sectionOrder?: unknown;
    fields?: unknown;
  };

  if (typeof pageSlug !== "string" || !/^[a-z0-9-]+$/.test(pageSlug)) {
    return NextResponse.json({ error: "Missing or invalid pageSlug." }, { status: 400 });
  }
  if (typeof locale !== "string" || !/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) {
    return NextResponse.json({ error: "Missing or invalid locale." }, { status: 400 });
  }
  const parent = typeof parentSlug === "string" && parentSlug.length > 0 ? parentSlug : null;
  const order = typeof sectionOrder === "number" ? sectionOrder : undefined;
  if (typeof fields !== "object" || fields === null) {
    return NextResponse.json({ error: "Missing fields object." }, { status: 400 });
  }

  const form = await findFormSection(pageSlug, locale, parent, order);
  if (!form) {
    return NextResponse.json(
      { error: "No matching form section found on the referenced page." },
      { status: 404 }
    );
  }

  // Build the cleaned values map, pulling only fields the form declares.
  const values: Record<string, string> = {};
  const clientFields = fields as Record<string, unknown>;
  for (const f of form.fields) {
    const raw = clientFields[f.name];
    const clean = cleanValue(raw);
    if (f.required && !clean) {
      return NextResponse.json(
        { error: `Field "${f.label}" is required.` },
        { status: 400 }
      );
    }
    values[f.name] = clean;
  }

  const subject = form.heading ? `[appai.info] ${form.heading}` : `[appai.info] Form submission`;
  const bodyText = renderPlainBody(form, values, { pageSlug, parentSlug: parent, locale, ip });

  if (form.submitTo.startsWith("mailto:")) {
    const to = form.submitTo.slice("mailto:".length);
    const result = await deliverMailto(to, subject, bodyText);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  } else if (/^https:\/\//.test(form.submitTo)) {
    const result = await deliverWebhook(form.submitTo, {
      pageSlug,
      parentSlug: parent,
      locale,
      heading: form.heading,
      values,
      submittedAt: new Date().toISOString(),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  } else {
    return NextResponse.json({ error: "Form submitTo is not a supported destination." }, { status: 500 });
  }

  // eslint-disable-next-line no-console
  console.log(`[form-submit] ${pageSlug} ${locale} ${form.submitTo} from ${ip}`);

  return NextResponse.json({ ok: true });
}
