import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { AsyncLocalStorage } from "node:async_hooks";
import { inspect } from "node:util";

// Real installed Next unstable_cache, with an isolated in-memory backing store.
// No DB, HTTP, auth mock or replacement cache implementation.
Object.assign(globalThis, { AsyncLocalStorage });
const require = createRequire(import.meta.url);
// Node 24 test runtime supports registerHooks; the application targets Node 20 typings.
const { registerHooks } = require("node:module");
const hook = registerHooks({ resolve(specifier: string, context: { parentURL?: string },
  next: (specifier: string, context: { parentURL?: string }) => unknown) {
  return next(specifier === "next/cache" ? "next/cache.js" : specifier, context);
} });
test.after(() => hook.deregister());
const { hostedDataCache } = await import("../src/lib/hosted-page-cache.ts");
const { workAsyncStorage } = require("next/dist/server/app-render/work-async-storage.external");

test("real Next TTL stale small→oversized returns fresh uncached data and never logs the payload", async t => {
  let clock = Date.now();
  t.mock.method(Date, "now", () => clock);
  let row = { text: "original small publisher text" }, failed = false, reads = 0, writes = 0, stale = false;
  let stored: {data: {body: string}} | null = null;
  const incrementalCache = {
    generateCacheKey: async (key: string) => key,
    get: async () => stored ? { isStale: stale, value: stored } : null,
    set: async (_key: string, value: typeof stored) => { writes++; stored = structuredClone(value); },
  };
  const load = hostedDataCache("real-stale-fixture", async () => {
    reads++; if (failed) throw new Error("Fictional DB unavailable"); return row;
  });
  async function request() {
    const store = { incrementalCache, route: "/p/fictional-stale", isStaticGeneration: false, isDraftMode: false,
      pendingRevalidates: {} as Record<string, Promise<unknown>> };
    try { return await workAsyncStorage.run(store, load); }
    finally { await Promise.all(Object.values(store.pendingRevalidates)); }
  }
  const warning = t.mock.method(console, "warn", () => {});
  const error = t.mock.method(console, "error", () => {});
  assert.deepEqual(await request(), row); assert.equal(reads,1); assert.equal(writes,1);
  assert.deepEqual(await request(), row); assert.equal(reads,1);
  clock += 86401 * 1000; stale = true;
  row = { text: "OVERSIZED_PUBLISHER_SENTINEL" + "x".repeat(1_810_000) };
  for (let n=0; n<2; n++) assert.deepEqual(await request(), row);
  assert.equal(writes,1, "no oversized cache write, including background refresh");
  assert.ok(warning.mock.callCount() >= 2);
  assert.equal(error.mock.callCount(),2, "exercise Next's real background rejection handling");
  assert.doesNotMatch(inspect(error.mock.calls.map(call => call.arguments), {depth:10}), /OVERSIZED_PUBLISHER_SENTINEL/);
  assert.doesNotMatch(JSON.stringify(stored), /OVERSIZED_PUBLISHER_SENTINEL/);
  // Neither failed foreground reads nor failed background refresh may serve the
  // old page as a success or turn an outage into a cached null/404.
  failed = true;
  await assert.rejects(request, /Fictional DB unavailable/);
  assert.equal(writes,1);
  failed = false; row = { text: "small again" };
  assert.deepEqual(await request(),row); assert.equal(writes,2);
  stale = false; const before = reads;
  assert.deepEqual(await request(),row); assert.equal(reads,before);
  t.diagnostic(`real Next: ${writes} small writes; oversized background writes=0; stale errors propagate`);
});
