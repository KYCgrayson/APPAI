// Runtime-independent decision logic. Conditional writes arbitrate concurrent requests.
export interface DeviceRecord {
  id: string; userCode: string; deviceCode: string; status: string;
  createdAt: Date; expiresAt: Date; apiKey: string | null;
  organizationId: string | null; lastPolledAt: Date | null; interval: number;
}
export interface DeviceStore {
  deviceCode: {
    findMany(args: { where: { status: string; expiresAt: { gt: Date } } }): Promise<DeviceRecord[]>;
    findUnique(args: { where: { deviceCode: string } }): Promise<DeviceRecord | null>;
    updateMany(args: { where: { id: string; status: string; expiresAt?: { gt: Date } }; data: { status?: string; apiKey?: string; organizationId?: string; interval?: number; lastPolledAt?: Date } }): Promise<{ count: number }>;
    deleteMany(args: { where: { id: string; status?: string; expiresAt?: { gt: Date } } }): Promise<{ count: number }>;
  };
  apiKey: { create(args: { data: { keyHash: string; keyPrefix: string; name: string; organizationId: string } }): Promise<unknown> };
}
export interface ApprovalStore extends DeviceStore {
  $transaction<T>(work: (tx: DeviceStore) => Promise<T>): Promise<T>;
}
const failure = (error: string, status = 409) => ({ error, status });
const normalize = (code: string) => code.toUpperCase().replace(/[-\s]/g, "");
async function findPending(db: DeviceStore, code: string, now: Date) {
  const rows = await db.deviceCode.findMany({ where: { status: "pending", expiresAt: { gt: now } } });
  return rows.find(row => normalize(row.userCode) === normalize(code));
}
export async function lookupDeviceRequest(db: DeviceStore, userCode: string, now: Date) {
  const row = await findPending(db, userCode, now);
  return row ? { userCode: row.userCode, status: row.status, createdAt: row.createdAt, expiresAt: row.expiresAt } : null;
}
export async function approveDeviceRequest(db: ApprovalStore, input: {
  userCode: string; organizationId: string; now: Date;
  createKey: () => { hash: string; prefix: string; encryptedKey: string };
}) {
  return db.$transaction(async tx => {
    const row = await findPending(tx, input.userCode, input.now);
    if (!row) return failure("Invalid, expired, or already used device code");
    const key = input.createKey();
    const result = await tx.deviceCode.updateMany({
      where: { id: row.id, status: "pending", expiresAt: { gt: input.now } },
      data: { status: "authorized", apiKey: key.encryptedKey, organizationId: input.organizationId },
    });
    if (result.count !== 1) return failure("Device code already used or expired");
    await tx.apiKey.create({ data: { keyHash: key.hash, keyPrefix: key.prefix,
      name: `Agent (Device Auth ${row.userCode})`, organizationId: input.organizationId } });
    return { ok: true };
  });
}
export async function denyDeviceRequest(db: DeviceStore, input: { userCode: string; now: Date }) {
  const row = await findPending(db, input.userCode, input.now);
  if (!row) return failure("Invalid, expired, or already used device code");
  const result = await db.deviceCode.updateMany({ where: { id: row.id, status: "pending", expiresAt: { gt: input.now } }, data: { status: "denied" } });
  return result.count === 1 ? { ok: true } : failure("Device code already used or expired");
}
export async function pollDeviceToken(db: DeviceStore, input: { deviceCode: string; now: Date; decrypt: (key: string) => string }) {
  const row = await db.deviceCode.findUnique({ where: { deviceCode: input.deviceCode } });
  const error = (error: string, error_description: string) => ({ error, error_description });
  if (!row) return error("invalid_grant", "Invalid device code");
  if (row.expiresAt <= input.now) {
    await db.deviceCode.deleteMany({ where: { id: row.id } });
    return error("expired_token", "The device code has expired");
  }
  if (row.status === "denied") return error("access_denied", "The user denied the authorization request");
  if (row.status === "authorized" && row.apiKey && row.organizationId) {
    const apiKey = input.decrypt(row.apiKey);
    const result = await db.deviceCode.deleteMany({ where: { id: row.id, status: "authorized", expiresAt: { gt: input.now } } });
    if (result.count !== 1) return error("invalid_grant", "This device code has already been used");
    return { status: "complete", api_key: apiKey, organization_id: row.organizationId, apiKey, organizationId: row.organizationId };
  }
  if (row.status !== "pending") return error("invalid_grant", "Invalid device code state");
  const tooFast = row.lastPolledAt && (input.now.getTime() - row.lastPolledAt.getTime()) / 1000 < row.interval;
  await db.deviceCode.updateMany({ where: { id: row.id, status: "pending" }, data: { lastPolledAt: input.now, ...(tooFast ? { interval: row.interval + 5 } : {}) } });
  if (tooFast) return { ...error("slow_down", "Polling too frequently, interval increased"), interval: row.interval + 5 };
  return error("authorization_pending", "The user has not yet completed authorization");
}
export function checkMutationRequest(headers: { get(name: string): string | null }, allowedHostname: string) {
  const source = headers.get("origin") || headers.get("referer");
  try {
    if (!source || new URL(source).hostname.replace(/^www\./, "") !== allowedHostname.replace(/^www\./, "")) return failure("Forbidden: invalid origin", 403);
  } catch { return failure("Forbidden: invalid origin", 403); }
  if (headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return failure("Content-Type must be application/json", 415);
  return null;
}
