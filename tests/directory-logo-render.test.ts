import assert from "node:assert/strict";
import test from "node:test";
import { fixtureDb, registerDirectoryFixtures, registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { registerMainHostedBaseline } from "./helpers/hosted-chrome-regression.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { app, page } from "./fixtures/pr5-pages.ts";
import { locales } from "../src/i18n/routing.ts";

const hooks = [registerHostedRenderLoader(), registerDirectoryFixtures({ translated: true })];
const baseline = registerMainHostedBaseline("baa8373", ["@/i18n/navigation"]);
test.after(() => { baseline.deregister(); hooks.reverse().forEach(h => h.deregister()); });
const { AppCard } = await import("../src/components/AppCard.tsx");
const { AppCard: BeforeCard } = await import(baseline.moduleUrl("src/components/AppCard.tsx"));
const { PlatformDirectory } = await import("../src/components/PlatformDirectory.tsx");
const { loadPublicDirectory, loadPublicHome } = await import("../src/lib/public-directory.ts");
const { default: home } = await import("../src/app/[locale]/page.tsx");

test("cards with existing logos render byte-for-byte as baa8373 in all nine locales", async () => {
  for (const locale of locales) {
    fixtureDb.locale = locale;
    const props = { app: { id: "logo", name: "Original app", tagline: "Original tagline", logoUrl: "/existing.svg",
      themeColor: "#ffaa00", category: "OTHER", iosUrl: "/ios", androidUrl: "/android" },
      href: "/p/example", localizedName: "👩🏽‍💻 網站", localizedTagline: "Localized tagline", publisherLabel: "Fixture studio",
      publisherPrefix: "By", isUniversalApp: true, canonicalHost: "example.test" };
    assert.equal(await renderHtml(await AppCard(props)), await renderHtml(await BeforeCard(props)), locale);
  }
});

function fixtures() {
  fixtureDb.apps = [
    app("z-letter", "letter"), app("y-header", "header"), app("x-hero", "hero"), app("w-existing", "existing", { logoUrl: "/existing.svg" }),
    app("v-person-letter", "person-letter"), app("u-person-logo", "person-logo"),
  ];
  fixtureDb.rows = [
    page("letter", { title: "👩🏽‍💻 Workshop", themeColor: "#ffee00", content: {}, heroImage: "/photo.jpg" }),
    page("header", { headerLogo: "/header.svg", content: { logo: "/primary.svg" } }),
    page("hero", { content: { sections: [{ type: "hero", data: { logo: "/hero.svg" } }] } }),
    page("existing", { headerLogo: "/other.svg" }),
    page("person-letter", { title: "網站", template: "PERSON", themeColor: "#123456" }),
    page("person-logo", { template: "PERSON", content: { logo: "/person.svg" } }),
  ];
  fixtureDb.organizations = [];
}

test("all locales and kinds use logo-first cards, including personal and fallback imagery", async () => {
  for (const locale of locales) for (const kind of [undefined, "websites", "tools", "apps"] as const) {
    fixtures(); fixtureDb.locale = locale;
    if (kind === "tools" || kind === "apps") for (const row of fixtureDb.apps) row.tags = [`appai:kind:${kind === "tools" ? "tool" : "app"}`];
    const data = await loadPublicDirectory(locale, kind);
    assert.deepEqual(data.entries.map(entry => entry.app.id), ["y-header", "x-hero", "w-existing", "z-letter"]);
    assert.deepEqual(data.entries.map(entry => entry.app.logoUrl), ["/header.svg", "/hero.svg", "/existing.svg", null]);
    const html = await renderHtml(await PlatformDirectory({ kind }));
    assert.ok(html.indexOf('href="/p/header"') < html.indexOf('href="/p/letter"'), `${locale}/${kind}`);
    assert.match(html, /background-color:#ffee00;color:#000000/);
    assert.match(html, />👩🏽‍💻<\/div>/);
    assert.doesNotMatch(html, /src="\/photo.jpg"/);
    if (!kind) {
      assert.match(html, /<div class="mt-6"><section aria-label=/, "separate logo groups retain vertical spacing");
      assert.ok(html.indexOf('href="/p/person-logo"') < html.indexOf('href="/p/header"'));
      assert.ok(html.indexOf('href="/p/existing"') < html.indexOf('href="/p/person-letter"'));
      assert.ok(html.indexOf('href="/p/person-letter"') < html.indexOf('href="/p/letter"'));
    }
    const personal = await renderHtml(await PlatformDirectory({ kind: "websites", personalOnly: true }));
    assert.ok(personal.indexOf('href="/p/person-logo"') < personal.indexOf('href="/p/person-letter"'));
    assert.match(personal, /background-color:#123456;color:#ffffff/);
  }
});

test("logo priority crosses the 50-card cache batch boundary and preserves newest/id ordering", async () => {
  fixtureDb.rows = [];
  fixtureDb.apps = Array.from({ length: 121 }, (_, i) => app(String(i).padStart(3, "0"), null, { logoUrl: i % 3 === 0 ? `/${i}.svg` : null }));
  const data = await loadPublicDirectory("en");
  const expected = [...fixtureDb.apps].reverse();
  assert.deepEqual(data.entries.map(entry => entry.app.id), [...expected.filter(a => a.logoUrl), ...expected.filter(a => !a.logoUrl)].map(a => a.id));
});

test("home keeps featured selection ahead of recent, real-logo priority within each, and projects only logos", async t => {
  fixtures(); fixtureDb.locale = "en";
  fixtureDb.apps[0].isFeatured = true;
  for (const row of fixtureDb.apps.slice(1)) row.isFeatured = false;
  const query = t.mock.method(fixtureDb, "$queryRaw");
  try {
    const data = await loadPublicHome("en");
    assert.deepEqual(data.featuredApps.map(a => a.id), ["z-letter"]);
    assert.deepEqual(data.recentApps.map(a => a.id), ["y-header", "x-hero", "w-existing", "u-person-logo", "z-letter", "v-person-letter"]);
    const sql = query.mock.calls[0].arguments[0];
    assert.match(sql.sql, /content->'logo' AS logo/);
    assert.match(sql.sql, /jsonb_array_elements\(CASE WHEN jsonb_typeof/);
    assert.match(sql.sql, /"isPublished" = true AND "parentSlug" IS NULL/);
    assert.doesNotMatch(sql.sql, /SELECT\s+\*|SELECT\s+content\b|heroImage/);
    assert.ok(sql.values.includes("letter"));
    const html = await renderHtml(await home());
    assert.ok(html.indexOf('href="/p/letter"') < html.indexOf('href="/p/header"'), "featured section wins");
    assert.match(html, /background-color:#ffee00;color:#000000/);
  } finally { query.mock.restore(); }
});

test("home logo projection excludes draft/child/foreign content and localizes the page colour", async () => {
  fixtures();
  fixtureDb.rows.push(page("letter", { id: "letter-ja", locale: "ja", isDefault: false, title: "日本語", themeColor: "#ffffff", headerLogo: "/ja.svg" }),
    page("letter", { id: "letter-fr", locale: "fr", isDefault: false, isPublished: false, headerLogo: "/draft.svg" }),
    page("letter", { id: "letter-es", locale: "es", isDefault: false, parentSlug: "header", headerLogo: "/child.svg" }),
    page("letter", { id: "letter-de", locale: "de", isDefault: false, organizationId: "foreign", headerLogo: "/foreign.svg" }));
  const japanese = (await loadPublicHome("ja")).recentApps.find(a => a.id === "z-letter")!;
  assert.equal(japanese.logoUrl, "/ja.svg"); assert.equal(japanese.themeColor, "#ffffff");
  for (const locale of ["fr", "es", "de"]) {
    const row = (await loadPublicHome(locale)).recentApps.find(a => a.id === "z-letter")!;
    assert.equal(row.logoUrl, null); assert.equal(row.themeColor, "#ffee00");
  }
});
