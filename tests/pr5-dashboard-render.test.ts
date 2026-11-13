import { removedPage } from "./fixtures/pr5-removal.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { fixtureDb, matchesWhere, registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { pr5State, registerPr5PublicFixtures } from "./helpers/pr5-public-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { dashboardStore } from "./helpers/pr5-sqlite.mjs";
import { f2Pages, page, PR5_NOW } from "./fixtures/pr5-pages.ts";
const hooks = [registerHostedRenderLoader(), registerPr5PublicFixtures()];
test.after(() => hooks.reverse().forEach(hook => hook.deregister()));
const { default: Pages } = await import("../src/app/dashboard/pages/page.tsx");
const { default: Dashboard } = await import("../src/app/dashboard/page.tsx");

test("dashboard renders English URL filters, groups, locale chips, hidden/mixed labels and correct logical-root usage", async () => {
  test.mock.timers.enable({ apis: ["Date"], now: PR5_NOW.getTime() });
  const rows = [...f2Pages(), page("hidden-root", { isPublished: false }),
    page("hidden-child", { parentSlug: "hidden-root" }), removedPage("trashed-root", "DELETED"), page("mixed"),
    page("mixed", { id: "mixed-ja", locale: "ja", isDefault: false, isPublished: false })];
  const store = dashboardStore(rows);
  pr5State.session = { organizationId: "org-a" };
  Object.assign(fixtureDb, {
    $queryRaw: store.$queryRaw.bind(store),
    apiKey: { async count() { return 0; } },
  });
  Object.assign(fixtureDb.organization, { async findUnique() { return { name: "Fixture", plan: "FREE" }; } });
  Object.assign(fixtureDb.app, { async count() { return 0; } });
  Object.assign(fixtureDb.hostedPage, {
    async groupBy(query: { by: string[]; where: Record<string, unknown> }) {
      assert.deepEqual(query, { by: ["slug"], where: { organizationId: "org-a", parentSlug: null, OR: [{ removalState: null }, { removalState: { not: "DELETED" } }] } });
      return [...new Set(rows.filter(row => matchesWhere(row, query.where)).map(row => row.slug))].map(slug => ({ slug }));
    },
  });
  try {
    const html = (await renderHtml(await Pages({ searchParams: Promise.resolve({}) }))).replace(/<!--.*?-->/g, "");
    for (const text of ["Created in the last 30 days", "Created", "Title or slug", "Older root", "en · default", "Hidden — root not public", "ja · Draft", "en · default · Published", "In Trash", "Removed by owner on 2026-11-12"]) assert.ok(html.includes(text), text);
    assert.equal((html.match(/<article /g) || []).length, 20); // 16 recent children + 4 logical status pages, including Trash.
    assert.doesNotMatch(html, /href="\/p\/hidden/);
    const usage = (await renderHtml(await Dashboard())).replace(/<!--.*?-->/g, "");
    assert.ok(usage.includes("3/3 used")); // 3 logical roots, regardless of children/locales.
  } finally { store.close(); test.mock.timers.reset(); pr5State.session = null; }
});


test("admin selection is logical-page scoped and displays hidden locales, removal and blocked-agent details", async () => {
  const { default: AdminPages } = await import("../src/app/admin/pages/page.tsx");
  const rows=[page("admin-root"),page("admin-root",{id:"admin-root-ja",locale:"ja",isDefault:false,isPublished:false}),
    page("admin-child",{parentSlug:"admin-root"}),page("admin-child",{id:"admin-child-ja",parentSlug:"admin-root",locale:"ja",isDefault:false}),removedPage("admin-trash","DELETED")];
  fixtureDb.rows=rows.map(row=>({...row,organization:{name:"Fixture organization"}}));
  Object.assign(fixtureDb,{
    user:{async findMany(){return [{id:"owner",name:"Fixture owner"}];}},
    hostedPageEvent:{async findMany(){return [{pageId:"admin-trash-en",createdAt:PR5_NOW}];}},
  });
  const html=(await renderHtml(await AdminPages({searchParams:Promise.resolve({})}))).replace(/<!--.*?-->/g,"");
  assert.equal((html.match(/<article /g)||[]).length,3);assert.equal((html.match(/type="checkbox"/g)||[]).length,3);
  for(const text of ["Hidden — root not public","In Trash","Removed by Fixture owner","Agent tried to republish"])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/href="\/p\/admin-root\/ja\/admin-child"/);
  for (const [filter, count] of [["published", 2], ["hidden", 0], ["draft", 0], ["trash", 1]] as const) {
    const filtered = await renderHtml(await AdminPages({ searchParams: Promise.resolve({ filter }) }));
    assert.equal((filtered.match(/<article /g) || []).length, count, filter);
  }
  assert.ok(html.includes("Unpublished (owner)"));
  assert.ok(html.includes("Unpublished (admin)"));
});
