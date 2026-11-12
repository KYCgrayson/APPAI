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
    page("hidden-child", { parentSlug: "hidden-root" }), page("mixed"),
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
      assert.deepEqual(query, { by: ["slug"], where: { organizationId: "org-a", parentSlug: null } });
      return [...new Set(rows.filter(row => matchesWhere(row, query.where)).map(row => row.slug))].map(slug => ({ slug }));
    },
  });
  try {
    const html = (await renderHtml(await Pages({ searchParams: Promise.resolve({}) }))).replace(/<!--.*?-->/g, "");
    for (const text of ["Created in the last 30 days", "Created", "Title or slug", "Older root", "en · default", "Hidden — root not public", "ja · Draft", "en · default · Published"]) assert.ok(html.includes(text), text);
    assert.equal((html.match(/<article /g) || []).length, 19); // 16 recent children + 3 logical status pages.
    assert.doesNotMatch(html, /href="\/p\/hidden/);
    const usage = (await renderHtml(await Dashboard())).replace(/<!--.*?-->/g, "");
    assert.ok(usage.includes("3/3 used")); // 3 logical roots, regardless of children/locales.
  } finally { store.close(); test.mock.timers.reset(); pr5State.session = null; }
});
