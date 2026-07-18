import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  simpleOrderSectionDataSchema,
  simpleOrderSubmissionSchema,
  type SimpleOrderSectionData,
  type SimpleOrderSubmission,
} from "@/lib/validations/simple-order-section";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function cleanText(value: string | undefined, max = 5000): string {
  return (value || "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max).trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMoney(value: number, currency = "TWD") {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "TWD" || currency === "JPY" ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

async function findSimpleOrderSection(
  slug: string,
  locale: string,
  parentSlug: string | null,
  sectionOrder: number | undefined,
): Promise<{
  config: SimpleOrderSectionData;
  access: "public" | "login";
  pageId: string;
  organizationId: string;
} | null> {
  const page = await db.hostedPage.findFirst({
    where: {
      slug,
      locale,
      parentSlug,
      isPublished: true,
    },
    select: { id: true, organizationId: true, content: true },
  });
  if (!page) return null;

  const sections = (page.content as {
    sections?: Array<{ type: string; order?: number; data: unknown }>;
  } | null)?.sections;
  if (!Array.isArray(sections)) return null;

  const matches = sections.filter((s) => s.type === "simple-order");
  if (matches.length === 0) return null;

  const target = sectionOrder !== undefined
    ? matches.find((s) => s.order === sectionOrder)
    : matches[0];
  if (!target) return null;
  const parsed = simpleOrderSectionDataSchema.safeParse(target.data);
  if (!parsed.success) return null;
  const access = target.data && typeof target.data === "object"
    && (target.data as { access?: unknown }).access === "login"
    ? "login"
    : "public";
  return {
    config: parsed.data,
    access,
    pageId: page.id,
    organizationId: page.organizationId,
  };
}

async function durableRateLimit({
  pageId,
  organizationId,
  actorId,
}: {
  pageId: string;
  organizationId: string;
  actorId: string;
}) {
  const connector = `simple-order:${pageId}`;
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const count = await db.usageEvent.count({
    where: { connector, userId: actorId, action: "submit.attempt", createdAt: { gte: since } },
  });
  if (count >= RATE_LIMIT) return false;
  await db.usageEvent.create({
    data: {
      connector,
      organizationId,
      userId: actorId,
      action: "submit.attempt",
    },
  });
  return true;
}

function normalizeSubmission(body: unknown): SimpleOrderSubmission {
  const parsed = simpleOrderSubmissionSchema.parse(body);
  return {
    ...parsed,
    customer: {
      name: cleanText(parsed.customer.name, 200),
      email: cleanText(parsed.customer.email, 320),
    },
    preferredDate: cleanText(parsed.preferredDate, 100),
    note: cleanText(parsed.note, 5000),
    items: parsed.items.map((item) => ({
      name: cleanText(item.name, 200),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
  };
}

function buildEmail(
  config: SimpleOrderSectionData,
  order: SimpleOrderSubmission,
  total: number,
) {
  const currency = config.currency || "TWD";
  const storeName = cleanText(config.storeName || config.heading || "Simple Order", 200);

  const itemRows = order.items
    .map((item) => {
      const subtotal = item.quantity * item.unitPrice;
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(item.unitPrice, currency)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(subtotal, currency)}</td>
        </tr>
      `;
    })
    .join("");

  const text = [
    `Payment confirmation requested: ${storeName}`,
    "",
    "The customer reports that payment was completed; AppAI has not verified it.",
    "Please verify payment, quantity, and date, then reply by email.",
    "",
    `Customer: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `Preferred date: ${order.preferredDate}`,
    `Payment URL: ${config.paymentUrl}`,
    "",
    "Items:",
    ...order.items.map((item) => {
      const subtotal = item.quantity * item.unitPrice;
      return `- ${item.name} x ${item.quantity} @ ${formatMoney(item.unitPrice, currency)} = ${formatMoney(subtotal, currency)}`;
    }),
    "",
    `Total: ${formatMoney(total, currency)}`,
    "",
    `Note: ${order.note || "N/A"}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h1 style="font-size:22px;margin:0 0 12px;">Payment confirmation requested: ${escapeHtml(storeName)}</h1>
      <p style="margin:0 0 16px;">The customer reports that payment was completed; AppAI has not verified it. Please verify payment, quantity, and date, then reply by email.</p>
      <table style="border-collapse:collapse;width:100%;max-width:680px;margin:16px 0;">
        <tbody>
          <tr><td style="padding:6px 0;color:#64748b;">Customer</td><td>${escapeHtml(order.customer.name)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Email</td><td>${escapeHtml(order.customer.email)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Preferred date</td><td>${escapeHtml(order.preferredDate)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Payment URL</td><td>${escapeHtml(config.paymentUrl)}</td></tr>
        </tbody>
      </table>
      <table style="border-collapse:collapse;width:100%;max-width:680px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #cbd5e1;">Item</th>
            <th style="text-align:right;padding:8px;border-bottom:2px solid #cbd5e1;">Qty</th>
            <th style="text-align:right;padding:8px;border-bottom:2px solid #cbd5e1;">Unit</th>
            <th style="text-align:right;padding:8px;border-bottom:2px solid #cbd5e1;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="font-size:18px;font-weight:700;margin:16px 0;">Total: ${formatMoney(total, currency)}</p>
      <p style="white-space:pre-wrap;"><strong>Note:</strong><br>${escapeHtml(order.note || "N/A")}</p>
    </div>
  `;

  return { text, html, storeName };
}

async function sendEmail({
  to,
  replyTo,
  subject,
  text,
  html,
}: {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.APPAI_EMAIL_FROM
    || (process.env.NODE_ENV === "production" ? "" : "AppAI Orders <onboarding@resend.dev>");

  if (!apiKey || !from) {
    return { ok: false as const, status: 503, error: "Email delivery is not configured." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: replyTo,
        subject,
        text,
        html,
      }),
      signal: controller.signal,
    });
  } catch {
    return { ok: false as const, status: 502, error: "Email delivery failed." };
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    return {
      ok: false as const,
      status: 502,
      error: "Email delivery failed.",
    };
  }

  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  let order: SimpleOrderSubmission;
  try {
    order = normalizeSubmission(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid order submission." }, { status: 400 });
  }

  const target = await findSimpleOrderSection(
    order.pageSlug,
    order.locale,
    order.parentSlug ?? null,
    order.sectionOrder,
  );
  if (!target) {
    return NextResponse.json(
      { error: "No matching simple-order section found on the referenced page." },
      { status: 404 },
    );
  }
  const { config } = target;
  const session = await auth();
  if (target.access === "login" && !session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const ipHash = createHash("sha256").update(getClientIp(request)).digest("hex").slice(0, 32);
  const actorId = session?.user?.id || `anonymous:${ipHash}`;
  const allowed = await durableRateLimit({
    pageId: target.pageId,
    organizationId: target.organizationId,
    actorId,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Try again later." },
      { status: 429, headers: { "Retry-After": String(RATE_WINDOW_MS / 1000) } },
    );
  }

  const maxItems = config.maxItems ?? 20;
  if (order.items.length > maxItems) {
    return NextResponse.json(
      { error: `This order form allows up to ${maxItems} items.` },
      { status: 400 },
    );
  }

  const total = order.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ error: "Order total must be greater than zero." }, { status: 400 });
  }

  const email = buildEmail(config, order, total);
  const result = await sendEmail({
    to: config.notificationEmail,
    replyTo: order.customer.email,
    subject: `Payment confirmation requested: ${email.storeName} (${formatMoney(total, config.currency || "TWD")})`,
    text: email.text,
    html: email.html,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, total, paymentStatus: "confirmation_pending" });
}
