import { createHmac, randomBytes } from "node:crypto";
import type { Connector } from "./registry.ts";

/**
 * Who a connector quota is charged to. Per-user quotas use the AppAI user id;
 * per-IP quotas use a one-way hash of the caller IP, stored in
 * UsageEvent.meta.ip (there is no IP column, and raw IPs are not stored).
 * The hash is an HMAC keyed by a server secret so stored values cannot be
 * brute-forced back to IPv4 addresses: CONNECTOR_IP_SALT, else AUTH_SECRET /
 * NEXTAUTH_SECRET, else a per-process random key (dev; quotas then reset on
 * restart, which is fine locally).
 */
let processSalt: string | null = null;

export function ipSalt(env: Record<string, string | undefined> = process.env): string {
  const configured = env.CONNECTOR_IP_SALT || env.AUTH_SECRET || env.NEXTAUTH_SECRET;
  if (configured) return configured;
  processSalt ??= randomBytes(32).toString("hex");
  return processSalt;
}

export function quotaSubject(per: "user" | "ip", userId: string | null, forwardedFor: string | null, salt: string = ipSalt()): string | null {
  if (per === "user") return userId;
  const ip = (forwardedFor ?? "").split(",")[0].trim() || "unknown";
  return "ip_" + createHmac("sha256", salt).update(`appai-connector:${ip}`).digest("hex").slice(0, 32);
}

/** Prisma `where` for counting the caller's billable usage in the window. */
export function quotaWhere(name: string, quota: NonNullable<Connector["quota"]>, who: string, since: Date) {
  return {
    connector: name,
    ...(quota.per === "user" ? { userId: who } : { meta: { path: ["ip"], equals: who } }),
    ...(quota.countActions ? { action: { in: quota.countActions } } : {}),
    createdAt: { gte: since },
  };
}
