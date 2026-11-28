import { createHash } from "node:crypto";
import type { Connector } from "./registry.ts";

/**
 * Who a connector quota is charged to. Per-user quotas use the AppAI user id;
 * per-IP quotas use a one-way hash of the caller IP, stored in
 * UsageEvent.meta.ip (there is no IP column, and raw IPs are not stored).
 */
export function quotaSubject(per: "user" | "ip", userId: string | null, forwardedFor: string | null): string | null {
  if (per === "user") return userId;
  const ip = (forwardedFor ?? "").split(",")[0].trim() || "unknown";
  return "ip_" + createHash("sha256").update(`appai-connector:${ip}`).digest("hex").slice(0, 32);
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
