import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server.js";
import { fixtureDb, registerHostedRenderLoader, registerDirectoryFixtures } from "./helpers/hosted-render-loader.mjs";
import { registerPublicDirectoryCache } from "./helpers/public-directory-cache.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { app, page } from "./fixtures/pr5-pages.ts";

const state = { entries: new Map(), registrations: [] as Array<{ keys: string[]; options: { tags: string[]; revalidate: number } }>,
  writes: [] as Array<{ keys: string[]; args: unknown[]; bytes: number; json: string }>, invalidations: [] as unknown[][],
  admin: true, failTag: "" };
const hooks = [registerHostedRenderLoader(), registerDirectoryFixtures({ translated: true }), registerPublicDirectoryCache(state)];
test.after(() => hooks.reverse().forEach(h => h.deregister()));
const { loadPublicDirectory, loadPublicHome, loadPublicAppDetail } = await import("../src/lib/public-directory.ts");
const { revalidateSeoIndexes } = await import("../src/lib/revalidate-seo.ts");
const admin = await import("../src/app/api/admin/apps/route.ts");
const { PlatformDirectory } = await import("../src/components/PlatformDirectory.tsx");
const { default: home } = await import("../src/app/[locale]/page.tsx");
const detail = await import("../src/app/[locale]/apps/[id]/page.tsx");
function reset() {
  state.entries.clear(); state.writes.length = state.invalidations.length = 0; state.admin = true;
  fixtureDb.locale = "en"; fixtureDb.rows = [page("cached", { title: "English fixture", content: { text: "x".repeat(2_100_000) } }),
    page("cached", { id: "cached-zh", locale: "zh-TW", isDefault: false, title: "快取測試" })];
  fixtureDb.apps = [app("cached", "cached", { url: null, iosUrl: null, androidUrl: null })];
  fixtureDb.organizations = [{ id: "org-a", name: "Fixture Studio", users: [] }];
}
const request = (action: string) => new NextRequest("https://example.test/api/admin/apps", {
  method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ appId: "cached", action }),
});

test("all public loaders use tagged one-hour data cache, with complete arguments and compact JSON DTOs", async () => {
  reset();
  assert.equal(state.registrations.length, 3);
  for (const registration of state.registrations) assert.deepEqual(registration.options, { revalidate: 3600, tags: ["public-directory"] });
  const calls = [() => loadPublicHome("en"), () => loadPublicDirectory("en"), () => loadPublicAppDetail("cached", "en")];
  for (const call of calls) {
    const first = await call();
    const writes = state.writes.length;
    assert.deepEqual(await call(), first);
    assert.equal(state.writes.length, writes);
  }
  // JSON serialization of the original Prisma fixtures changes their Dates.
  assert.ok(fixtureDb.apps[0].createdAt instanceof Date);
  assert.equal(typeof JSON.parse(JSON.stringify(fixtureDb.apps[0])).createdAt, "string");
  for (const write of state.writes) {
    assert.ok(write.bytes < 2 * 1024 * 1024);
    assert.doesNotMatch(write.json, /"(?:content|createdAt|updatedAt)":/);
  }
  assert.equal((await loadPublicHome("zh-TW")).featuredApps[0].localized?.title, "快取測試");
  await loadPublicDirectory("zh-TW", "websites", "OTHER", false);
  await loadPublicDirectory("en", "tools", "OTHER", false);
  await loadPublicDirectory("en", "apps", "OTHER", false);
  await loadPublicDirectory("en", "websites", "OTHER", true);
  await loadPublicAppDetail("cached", "zh-TW");
  assert.equal(await loadPublicAppDetail("missing", "en"), null);
  const batchArgs = state.writes.filter(w => w.keys[0].includes("batch")).map(w => w.args);
  assert.deepEqual(batchArgs, [["en", null, "ALL", false, 0], ["zh-TW", "websites", "OTHER", false, 0],
    ["en", "tools", "OTHER", false, 0], ["en", "apps", "OTHER", false, 0], ["en", "websites", "ALL", true, 0]]);
  // Both miss and hit render valid localized HTML / JSON-LD without Date methods.
  for (let i = 0; i < 2; i++) {
    assert.match(await renderHtml(await home()), /English fixture/);
    assert.match(await renderHtml(await PlatformDirectory({})), /English fixture/);
    const props = { params: Promise.resolve({ id: "cached", locale: "en" }) };
    assert.equal((await detail.generateMetadata(props)).title, "English fixture - AppAI");
    const html = await renderHtml(await detail.default(props));
    const jsonLd = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1];
    assert.equal(JSON.parse(jsonLd).name, "English fixture");
  }
});

test("directory batch keys include pagination and preserve all listings without caching entire content", async () => {
  reset();
  fixtureDb.rows = [];
  fixtureDb.apps = Array.from({ length: 121 }, (_, i) => app(`standalone-${String(i).padStart(3, "0")}`, null));
  const data = await loadPublicDirectory("en");
  assert.equal(data.entries.length, 121);
  assert.equal(new Set(data.entries.map(entry => entry.app.id)).size, 121);
  assert.deepEqual(state.writes.map(w => w.args.at(-1)), [0, 50, 100]);
  const writes = state.writes.length;
  assert.deepEqual(await loadPublicDirectory("en"), data);
  assert.equal(state.writes.length, writes);
});

test("20 repeated page renders perform directory database reads on the first request only", async t => {
  reset();
  for (const [name, render] of [["home", () => home()], ["apps", () => PlatformDirectory({})],
    ["detail", () => detail.default({ params: Promise.resolve({ id: "cached", locale: "en" }) })]] as const) {
    state.entries.clear();
    const mocks = [t.mock.method(fixtureDb.hostedPage, "findMany"), t.mock.method(fixtureDb.app, "findMany"),
      t.mock.method(fixtureDb.app, "findFirst"), t.mock.method(fixtureDb.appRelease, "findMany"), t.mock.method(fixtureDb.organization, "findMany")];
    const count = () => mocks.reduce((sum, mock) => sum + mock.mock.callCount(), 0);
    try {
      await renderHtml(await render()); const first = count();
      assert.ok(first > 0);
      for (let i = 1; i < 20; i++) await renderHtml(await render());
      assert.equal(count(), first);
      t.diagnostic(`${name}: 20 renders, first=${first}, following 19=0 database delegate reads (JSON cache mock)`);
    } finally { mocks.forEach(mock => mock.mock.restore()); }
  }
});

test("SEO invalidation immediately expires public-directory even if sitemap invalidation fails", async t => {
  reset(); await loadPublicHome("en");
  fixtureDb.apps[0].isApproved = false;
  assert.equal((await loadPublicHome("en")).featuredApps.length, 1);
  state.failTag = "seo-sitemap";
  const errors = t.mock.method(console, "error", () => {});
  try { assert.equal(revalidateSeoIndexes("all"), false); }
  finally { state.failTag = ""; errors.mock.restore(); }
  assert.deepEqual(state.invalidations, [["seo-sitemap", { expire: 0 }], ["public-directory", { expire: 0 }]]);
  assert.equal((await loadPublicHome("en")).featuredApps.length, 0);
});

test("all four admin actions invalidate after successful write; unapprove removes warmed home/directory/detail on next read", async t => {
  const update = t.mock.method(fixtureDb.app, "update", async ({ data }: { data: object }) => Object.assign(fixtureDb.apps[0], data));
  try {
    for (const action of ["approve", "unapprove", "feature", "unfeature"]) {
      reset();
      const initial = await renderHtml(await home()); assert.match(initial, /English fixture/);
      assert.match(await renderHtml(await PlatformDirectory({})), /English fixture/);
      assert.ok(await loadPublicAppDetail("cached", "en"));
      const response = await admin.PATCH(request(action));
      assert.equal(response.status, 200);
      assert.deepEqual(state.invalidations, [["seo-sitemap", { expire: 0 }], ["public-directory", { expire: 0 }]]);
      if (action === "unapprove") {
        assert.doesNotMatch(await renderHtml(await home()), /English fixture/);
        assert.doesNotMatch(await renderHtml(await PlatformDirectory({})), /English fixture/);
        assert.equal(await loadPublicAppDetail("cached", "en"), null);
        const props = { params: Promise.resolve({ id: "cached", locale: "en" }) };
        assert.deepEqual((await detail.generateMetadata(props)).robots, { index: false });
        await assert.rejects(() => detail.default(props), /404/);
      }
      if (action === "unfeature") {
        assert.equal((await loadPublicHome("en")).featuredApps.length, 0);
        assert.equal((await loadPublicHome("en")).recentApps.length, 1);
      }
    }
  } finally { update.mock.restore(); }
});

test("admin deletion invalidates; unauthorized, invalid and failed writes do not", async t => {
  reset(); await loadPublicHome("en");
  const deleted = t.mock.method(fixtureDb.app, "delete", async () => { fixtureDb.apps = []; });
  try { assert.equal((await admin.DELETE(request("approve"))).status, 200); }
  finally { deleted.mock.restore(); }
  assert.equal((await loadPublicHome("en")).recentApps.length, 0);
  reset(); state.admin = false;
  assert.equal((await admin.PATCH(request("approve"))).status, 403);
  state.admin = true;
  assert.equal((await admin.PATCH(request("invalid"))).status, 400);
  const failed = t.mock.method(fixtureDb.app, "update", async () => { throw new Error("Fixture write failure"); });
  try { await assert.rejects(() => admin.PATCH(request("approve")), /write failure/); }
  finally { failed.mock.restore(); }
  assert.deepEqual(state.invalidations, []);
});

test("visibility mutations invalidate after transaction commit, including existing page approval callers", () => {
  const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
  assert.match(read("lib/page-write-guard.ts"), /if \(!blocked && response.ok\) revalidateSeoIndexes/);
  assert.match(read("app/api/dashboard/pages/actions/route.ts"), /input.dryRun \? true : revalidateSeoIndexes\("all"\)/);
  assert.match(read("app/api/v1/apps/route.ts"), /return withPageWrite/);
  assert.match(read("app/api/v1/apps/[id]/route.ts"), /await db.app.delete[\s\S]*revalidateSeoIndexes\(\)/);
  assert.match(read("app/api/v1/apps/[id]/releases/route.ts"), /await db.\$transaction[\s\S]*\}\);\s*revalidateSeoIndexes\(\)/);
  assert.match(read("lib/universal-apps/activation.ts"), /const result = await db.\$transaction[\s\S]*\}\);[\s\S]*revalidateSeoIndexes\(\);\s*return result/);
  for (const file of ["route.ts", "[slug]/route.ts", "[slug]/publish/route.ts", "[slug]/set-default/route.ts", "[slug]/sections/[order]/route.ts"]) {
    const source = read(`app/api/v1/pages/${file}`);
    assert.match(source, /hostedPageApprovalUpdate/);
    assert.match(source, /withPageWrite/);
  }
});
