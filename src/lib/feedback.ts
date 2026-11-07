import { createHash } from "node:crypto";
import { z } from "zod";

export const feedbackKinds = ["missing_feature", "bug", "docs", "other"] as const;
const httpUrl = z.string().max(2048).url().refine(value => ["https:", "http:"].includes(new URL(value).protocol));
export const feedbackSchema = z.object({
  kind: z.enum(feedbackKinds),
  message: z.string().trim().min(10).max(4000),
  pageSlug: z.string().trim().min(1).max(256).optional(),
  specUrl: httpUrl.optional(),
});
const webSchema = feedbackSchema.extend({
  contactEmail: z.email().max(254),
  pageUrl: httpUrl.optional(),
  turnstileToken: z.string().max(2048).optional(),
});
export type FeedbackData = z.infer<typeof feedbackSchema> & {
  source: "agent" | "web"; contactEmail: string; pageSlug?: string;
  organizationId?: string; userId?: string; apiKeyId?: string; ipHash?: string; userAgent?: string;
};
type Env = Record<string, string | undefined>;
export function turnstileEnabled(env: Env) {
  return Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
}
export function webFeedbackAvailable(env: Env) {
  return env.NODE_ENV !== "production" || turnstileEnabled(env);
}
export async function loadAdminFeedback<T>(load: () => Promise<T>): Promise<T | null> {
  try { return await load(); } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2021") return null;
    throw error;
  }
}
const MAX_BODY_BYTES = 16 * 1024;
class FeedbackBodyTooLarge extends Error {}
async function readFeedbackBody(request: Request) {
  const length = request.headers.get("content-length");
  if (length !== null && Number(length) > MAX_BODY_BYTES) throw new FeedbackBodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) return JSON.parse("");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new FeedbackBodyTooLarge();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function feedbackIpHash(ip: string, env: Env) {
  return env.FEEDBACK_IP_SALT ? createHash("sha256").update(`${env.FEEDBACK_IP_SALT}\0${ip}`).digest("hex") : undefined;
}
export async function verifyTurnstile(token: string | undefined, env: Env, send: typeof fetch = fetch) {
  if (!turnstileEnabled(env)) return webFeedbackAvailable(env);
  if (!token) return false;
  try {
    const response = await send("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY!, response: token }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok && (await response.json()).success === true;
  } catch { return false; }
}
export async function notifyFeedback(data: FeedbackData, env: Env, send: typeof fetch = fetch) {
  if (!env.FEEDBACK_NOTIFY_EMAIL || !env.RESEND_API_KEY || !env.APPAI_EMAIL_FROM) return;
  try {
    const response = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.APPAI_EMAIL_FROM, to: env.FEEDBACK_NOTIFY_EMAIL,
        reply_to: data.contactEmail, subject: `AppAI feedback: ${data.kind}`,
        text: `Source: ${data.source}\nKind: ${data.kind}\nPage: ${data.pageSlug || "—"}\nSpec: ${data.specUrl || "—"}\n\n${data.message}` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) console.error("Feedback notification delivery failed");
  } catch { console.error("Feedback notification delivery failed"); }
}
type OrganizationContact = { id: string; email: string | null; role: string; createdAt: Date };
export function selectFeedbackContact(users: OrganizationContact[]) {
  const ordered = [...users].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  return ordered.find(user => user.role === "ADMIN") ?? ordered[0];
}
export async function saveWebFeedback<T>(store: {
  lock(): Promise<unknown>;
  count(since: Date): Promise<number>;
  create(): Promise<T>;
}): Promise<T | null> {
  await store.lock();
  if (await store.count(new Date(Date.now() - 86400000)) >= 200) return null;
  return store.create();
}
export type FeedbackIdentity = { apiKeyId: string; organizationId: string; userId: string; contactEmail: string };
export interface FeedbackDeps {
  authenticate(header: string | null): Promise<FeedbackIdentity | null>;
  // Implementations serialize count and insert per key or globally for web. null means quota exceeded.
  save(data: FeedbackData): Promise<{ id: string } | null>;
  notify(data: FeedbackData): Promise<void>;
  env: Env;
  fetch?: typeof fetch;
}
export async function submitFeedback(request: Request, source: "agent" | "web", deps: FeedbackDeps) {
  if (source === "web" && !webFeedbackAvailable(deps.env)) {
    return Response.json({ error: "Feedback temporarily unavailable — agents can use the API" }, { status: 503 });
  }
  const identity = source === "agent" ? await deps.authenticate(request.headers.get("authorization")) : null;
  if (source === "agent" && !identity) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try { body = await readFeedbackBody(request); } catch (error) {
    return Response.json({ error: error instanceof FeedbackBodyTooLarge ? "Feedback body too large" : "Invalid feedback" }, { status: error instanceof FeedbackBodyTooLarge ? 413 : 400 });
  }
  if (source === "web" && typeof body?.website === "string" && body.website.length > 0) return Response.json({ ok: true }, { status: 201 });
  const parsed = (source === "agent" ? feedbackSchema : webSchema).safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid feedback" }, { status: 400 });
  const input = parsed.data;
  if (source === "web" && !await verifyTurnstile("turnstileToken" in input ? input.turnstileToken as string : undefined, deps.env, deps.fetch)) {
    return Response.json({ error: "Verification failed" }, { status: 400 });
  }
  const data: FeedbackData = {
    source, kind: input.kind, message: input.message, pageSlug: input.pageSlug,
    specUrl: input.specUrl,
    ...(identity || { contactEmail: (input as z.infer<typeof webSchema>).contactEmail }),
    userAgent: request.headers.get("user-agent")?.slice(0, 512),
  };
  if (source === "web") {
    data.pageSlug = (input as z.infer<typeof webSchema>).pageUrl || input.pageSlug;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
    if (ip) data.ipHash = feedbackIpHash(ip, deps.env);
  }
  let saved;
  try {
    saved = await deps.save(data);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2021") {
      return Response.json({ error: "Feedback is not available yet" }, { status: 503 });
    }
    throw error;
  }
  if (!saved) return Response.json({ error: "Daily feedback limit reached" }, { status: 429 });
  await deps.notify(data);
  return Response.json({ id: saved.id }, { status: 201 });
}
