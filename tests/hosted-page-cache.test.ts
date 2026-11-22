import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixtureDb, registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { registerPublicDirectoryCache } from "./helpers/public-directory-cache.mjs";
import { page, app } from "./fixtures/pr5-pages.ts";

const state = { entries: new Map(), registrations: [] as {keys: string[]; options: {tags: string[]; revalidate: number}}[],
  writes: [] as {keys: string[]; args: unknown[]; bytes: number; json: string}[], invalidations: [] as unknown[][], failTag: "" };
const hooks = [registerHostedRenderLoader(), registerPublicDirectoryCache(state)];
test.after(() => hooks.reverse().forEach(h => h.deregister()));
const loaders = await import("../src/lib/public-hosted-page.ts");
const { resolvePage, resolveChildPage } = await import("../src/lib/hosted-page-resolver.ts");
const { loadSiblings } = await import("../src/lib/site-nav.ts");
const { revalidateSeoIndexes } = await import("../src/lib/revalidate-seo.ts");
const { hostedDataCache, hostedEntryBytes, HOSTED_PAGE_CACHE_MAX_BYTES } = await import("../src/lib/hosted-page-cache.ts");
function reset() {
  state.entries.clear(); state.writes.length = state.invalidations.length = 0;
  fixtureDb.rows = [page("cached"), page("cached", { id: "cached-zh", locale: "zh-TW", isDefault: false, title: "軟體測試" }),
    page("cached-child", { parentSlug: "cached" })];
  fixtureDb.apps = [app("cached-app", "cached")];
}

test("every hosted cache family has the global tag and one-day TTL", () => {
  assert.equal(state.registrations.length, 6);
  for (const entry of state.registrations) assert.deepEqual(entry.options, { tags: ["hosted-page"], revalidate: 86400 });
});
test("cold/hot Dates, Chinese conversion, nav ordering and allowlisted publisher DTOs survive JSON", async t => {
  reset();
  Object.assign(fixtureDb.rows[0], { session: { token: "PRIVATE_SESSION" }, user: { email: "PRIVATE_VIEWER" },
    removalState: "PRIVATE_AUDIT", customDomain: "PRIVATE_DOMAIN", removedById: "PRIVATE_ACTOR" });
  fixtureDb.rows.push(page("cached-first", { parentSlug: "cached", navOrder: 0 }));
  const reads = t.mock.method(fixtureDb.hostedPage, "findFirst");
  const cold = await resolvePage("cached", null);
  const hot = await resolvePage("cached", null);
  assert.deepEqual(hot, cold); assert.equal(reads.mock.callCount(), 1);
  assert.ok(hot?.createdAt instanceof Date); assert.ok(hot?.updatedAt instanceof Date);
  assert.equal(hot.createdAt.toISOString(), (fixtureDb.rows[0].createdAt as Date).toISOString());
  assert.equal((await resolvePage("cached", "zh-CN"))?.title, "软体测试");
  const nav = await loadSiblings("cached", "org-a", "en");
  assert.equal(nav[0].slug, "cached-first"); assert.ok(nav[0].createdAt instanceof Date);
  assert.deepEqual(await loadSiblings("cached", "org-a", "en"), nav);
  await loaders.loadHostedRootVariants("cached", "org-a");
  await loaders.loadHostedChildVariants("org-a", "cached", "cached-child");
  await loaders.loadHostedMembership("org-a", "cached");
  for (const write of state.writes) {
    assert.doesNotMatch(write.json, /PRIVATE_|"(?:user|session|removedById|customDomain|removalState)":/);
    assert.ok(hostedEntryBytes(JSON.parse(write.json)) < 10_000, `normal fixture: ${write.bytes} bytes`);
  }
  t.diagnostic(`normal fixture max entry: ${Math.max(...state.writes.map(w => w.bytes))} bytes / ${HOSTED_PAGE_CACHE_MAX_BYTES}`);
});
test("null/empty hits, locale/null/org/child keys and DB errors remain separate", async t => {
  reset();
  const read = t.mock.method(fixtureDb.hostedPage, "findFirst");
  assert.equal(await resolvePage("missing", null), null);
  const n = read.mock.callCount(); assert.equal(await resolvePage("missing", null), null); assert.equal(read.mock.callCount(), n);
  assert.equal(await resolveChildPage("cached", "missing-child", null, "org-a"), null);
  const m = read.mock.callCount(); assert.equal(await resolveChildPage("cached", "missing-child", null, "org-a"), null); assert.equal(read.mock.callCount(), m);
  assert.equal(await resolveChildPage("cached", "cached-child", null, "org-b"), null);
  for (const locale of [null, "en", "zh-TW", "zh-CN", "ja"]) await loaders.loadHostedRoot("cached", locale);
  for (const org of [null, "org-a", "org-b"]) await loaders.loadHostedRootVariants("cached", org);
  for (const org of ["org-a", "org-b"]) for (const slug of ["cached-child", "missing-child"])
    await loaders.loadHostedChild(org, "cached", slug, "en");
  assert.equal(state.writes.filter(w => w.keys[0] === "hosted-page-root-v2" && w.args[0] === "cached").length, 5);
  assert.equal(state.writes.filter(w => w.keys[0].includes("root-variants")).length, 3);
  assert.equal(state.writes.filter(w => w.keys[0] === "hosted-page-child-v2" && w.args[3] === "en").length, 4);
  let failures = 0;
  const fail = hostedDataCache("failed-fixture", async () => { failures++; throw new Error("DB unavailable"); });
  await assert.rejects(fail, /DB unavailable/); await assert.rejects(fail, /DB unavailable/); assert.equal(failures, 2);
});
test("oversized section, policy, CSS and multibyte/escaped DTOs are never written, even on a second read", async t => {
  for (const field of ["content", "privacyPolicy", "customCss"]) {
    reset();
    const payload = '漢🙂\\"'.repeat(220_000);
    fixtureDb.rows[0][field] = field === "content" ? { sections: [{type: "about", order: 0, data: { text: payload }}] } : payload;
    const warnings = t.mock.method(console, "warn", () => {});
    const reads = t.mock.method(fixtureDb.hostedPage, "findFirst");
    try {
      const cold = await loaders.loadHostedRoot("cached", null);
      assert.deepEqual(await loaders.loadHostedRoot("cached", null), cold);
      assert.deepEqual(cold?.[field as keyof typeof cold], fixtureDb.rows[0][field]);
      assert.equal(reads.mock.callCount(), 2); assert.equal(state.writes.length, 0); assert.equal(state.entries.size, 0);
      assert.equal(warnings.mock.callCount(), 2);
      assert.match(JSON.stringify(warnings.mock.calls[0].arguments), /cached/);
    } finally { warnings.mock.restore(); reads.mock.restore(); }
  }
});
test("no-argument SEO invalidation expires all hosted entries, including negative cache and membership", async () => {
  reset();
  await resolvePage("missing", null); await loaders.loadHostedMembership("org-a", "cached"); await resolvePage("cached", null);
  fixtureDb.apps[0].isApproved = false; fixtureDb.rows.push(page("missing"));
  assert.equal(await resolvePage("missing", null), null);
  assert.ok(await loaders.loadHostedMembership("org-a", "cached"));
  assert.equal(revalidateSeoIndexes(), true);
  assert.deepEqual(state.invalidations.at(-1), ["hosted-page", { expire: 0 }]);
  assert.equal(await loaders.loadHostedMembership("org-a", "cached"), null);
  assert.ok(await resolvePage("cached", null)); assert.ok(await resolvePage("missing", null));
});
test("cache callbacks have no request API imports and render paths have no direct DB access", () => {
  const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  assert.doesNotMatch(read("lib/public-hosted-page.ts"), /next\/headers|lib\/auth|unstable_cache/);
  for (const path of ["app/(legacy)/layout.tsx", "app/(legacy)/not-found.tsx", "app/(legacy)/p/[...segments]/page.tsx", "app/(legacy)/p/[...segments]/layout.tsx",
    "lib/site-nav.ts", "lib/hosted-breadcrumbs.ts", "lib/hosted-page-resolver.ts"]) assert.doesNotMatch(read(path), /db\.hostedPage|db\.app\./);
  assert.doesNotMatch(read("app/(legacy)/p/[...segments]/page.tsx"), /revalidate\s*=\s*60/);
});

test("size budget includes Next's second JSON escaping pass", async t => {
  reset();
  const dto = { text: '"'.repeat(600_000) };
  assert.ok(Buffer.byteLength(JSON.stringify(dto)) < HOSTED_PAGE_CACHE_MAX_BYTES);
  assert.ok(hostedEntryBytes(dto) > 2 * 1024 * 1024);
  const warn = t.mock.method(console, "warn", () => {});
  const call = hostedDataCache("escaped-fixture", async () => dto);
  try { assert.deepEqual(await call(), dto); assert.equal(state.writes.length, 0); }
  finally { warn.mock.restore(); }
});

test("hosted cache facade never nests persistent callbacks", async () => {
  reset();
  await resolveChildPage("cached", "cached-child", null, "org-a");
  await loaders.loadHostedChildVariants("org-a", "cached", "cached-child");
  await loadSiblings("cached", "org-a", "en");
  await loaders.loadHostedMembership("org-a", "cached");
  const leaf = hostedDataCache("leaf-fixture", async () => null);
  const nested = hostedDataCache("nested-fixture", async () => leaf());
  await assert.rejects(nested, /Nested unstable_cache/); // prove the test hook detects nesting
});
