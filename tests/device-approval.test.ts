import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lookupDeviceRequest, approveDeviceRequest, denyDeviceRequest, pollDeviceToken, checkMutationRequest } from "../src/lib/device-approval.ts";
import type { ApprovalStore, DeviceRecord } from "../src/lib/device-approval.ts";

const now = new Date("2026-01-01T00:00:00Z");
function fake() {
  let row: DeviceRecord | null = { id: "id", userCode: "BCDF-GHJK", deviceCode: "secret", status: "pending", createdAt: now, expiresAt: new Date(+now + 60000), apiKey: null, organizationId: null, lastPolledAt: null, interval: 5 };
  let keys = 0, writes = 0;
  const matches = (where: { id: string; status?: string; expiresAt?: { gt: Date } }) => row && row.id === where.id && (!where.status || row.status === where.status) && (!where.expiresAt || row.expiresAt > where.expiresAt.gt);
  const db: ApprovalStore = {
    deviceCode: {
      async findMany({ where }) { return row && row.status === where.status && row.expiresAt > where.expiresAt.gt ? [{ ...row }] : []; },
      async findUnique({ where }) { return row?.deviceCode === where.deviceCode ? { ...row } : null; },
      async updateMany({ where, data }) { writes++; if (!matches(where)) return { count: 0 }; Object.assign(row!, data); return { count: 1 }; },
      async deleteMany({ where }) { writes++; if (!matches(where)) return { count: 0 }; row = null; return { count: 1 }; },
    },
    apiKey: { async create() { keys++; } },
    async $transaction(work) { return work(db); },
  };
  return { db, keys: () => keys, writes: () => writes, expire: () => { row!.expiresAt = now; } };
}
const approve = (db: ApprovalStore) => approveDeviceRequest(db, { userCode: "bcdf ghjk", organizationId: "org", now, createKey: () => ({ hash: "hash", prefix: "prefix", encryptedKey: "encrypted" }) });
const poll = (db: ApprovalStore) => pollDeviceToken(db, { deviceCode: "secret", now, decrypt: () => "key" });

const pollError = async (db: ApprovalStore) => { const result = await poll(db); assert.ok("error" in result); return result.error; };

test("page only mutates from explicit decision clicks; lookup is read-only", async () => {
  const source = readFileSync(new URL("../src/app/[locale]/auth/device/page.tsx", import.meta.url), "utf8");
  const effect = source.slice(source.indexOf("useEffect(() =>"), source.indexOf("async function handleDecision"));
  assert.doesNotMatch(effect, /POST|handleDecision\(|approveDevice/);
  assert.match(effect, /\/api\/auth\/device\/lookup/);
  assert.match(source, /onClick=\{\(\) => handleDecision\("approve"\)\}/);
  assert.match(source, /onClick=\{\(\) => handleDecision\("deny"\)\}/);
  const f = fake();
  assert.deepEqual(await lookupDeviceRequest(f.db, "BCDFGHJK", now), { userCode: "BCDF-GHJK", status: "pending", createdAt: now, expiresAt: new Date(+now + 60000) });
  assert.equal(f.writes(), 0);
});
test("approval and concurrent polling deliver the key exactly once", async () => {
  const f = fake();
  assert.deepEqual(await approve(f.db), { ok: true });
  const results = await Promise.all([poll(f.db), poll(f.db)]);
  assert.equal(results.filter(r => "apiKey" in r && r.apiKey === "key").length, 1);
  assert.equal(results.filter(r => "error" in r && r.error === "invalid_grant").length, 1);
  assert.equal(await pollError(f.db), "invalid_grant");
  assert.equal(f.keys(), 1);
});
test("denial returns access_denied and cannot be approved", async () => {
  const f = fake();
  assert.deepEqual(await denyDeviceRequest(f.db, { userCode: "BCDF-GHJK", now }), { ok: true });
  assert.equal(await pollError(f.db), "access_denied");
  assert.ok("error" in await approve(f.db));
  assert.equal(f.keys(), 0);
});
test("expired and unknown codes cannot be approved or looked up", async () => {
  const f = fake(); f.expire();
  assert.ok("error" in await approve(f.db));
  assert.equal(await pollError(f.db), "expired_token");
  assert.equal(f.writes(), 1);
  assert.equal(await f.db.deviceCode.findUnique({ where: { deviceCode: "secret" } }), null);
  assert.equal(await pollError(f.db), "invalid_grant");
  assert.equal(await lookupDeviceRequest(f.db, "BCDF-GHJK", now), null);
  assert.equal(await lookupDeviceRequest(f.db, "unknown", now), null);
  assert.equal(f.keys(), 0);
});
test("concurrent and repeated approval create only one key", async () => {
  const f = fake();
  const results = await Promise.all([approve(f.db), approve(f.db)]);
  assert.equal(results.filter(r => "ok" in r).length, 1);
  assert.ok("error" in await approve(f.db));
  assert.equal(f.keys(), 1);
});
test("pending polls and polling interval", async () => {
  const f = fake();
  assert.equal(await pollError(f.db), "authorization_pending");
  assert.equal(await pollError(f.db), "slow_down");
});
test("mutation guard enforces same-host source and JSON", () => {
  const guard = (headers: Record<string, string>) => checkMutationRequest(new Headers(headers), "appai.info");
  assert.equal(guard({ "content-type": "application/json" })?.status, 403);
  assert.equal(guard({ origin: "https://evil.test", "content-type": "application/json" })?.status, 403);
  assert.equal(guard({ origin: "https://appai.info", "content-type": "text/plain" })?.status, 415);
  assert.equal(guard({ origin: "https://appai.info" })?.status, 415);
  assert.equal(guard({ origin: "https://appai.info", "content-type": "application/json; charset=utf-8" }), null);
  assert.equal(guard({ referer: "https://www.appai.info/auth/device", "content-type": "application/json" }), null);
  assert.equal(guard({ origin: "bad", "content-type": "application/json" })?.status, 403);
});
