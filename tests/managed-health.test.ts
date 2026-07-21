import assert from "node:assert/strict";
import test from "node:test";

import { checkManagedRuntimeHealthWithRetry } from "../src/lib/universal-apps/managed-health.ts";

const expected = { appId: "inventory-db", version: "1.0.0", healthPath: "/health" };
test("custom host health retries until exact contract succeeds", async () => {
  let calls = 0;
  await checkManagedRuntimeHealthWithRetry("https://inventory-db.appai.info", expected, {
    attempts: 3,
    delayMs: 0,
    wait: async () => {},
    fetcher: async () => {
      calls += 1;
      return calls < 3 ? new Response("not ready", { status: 503 }) : Response.json({ ok: true, appId: expected.appId, version: expected.version });
    },
  });
  assert.equal(calls, 3);
});
test("custom host health exhaustion preserves the strict contract", async () => {
  await assert.rejects(() => checkManagedRuntimeHealthWithRetry("https://inventory-db.appai.info", expected, {
    attempts: 2, delayMs: 0, wait: async () => {}, fetcher: async () => Response.json({ ok: true, appId: "other", version: expected.version }),
  }), /HEALTH_CONTRACT_MISMATCH/);
});
