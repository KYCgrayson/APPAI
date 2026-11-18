import assert from "node:assert/strict";
import test from "node:test";
import { renderHtml } from "./helpers/render-html.mjs";
import { fixtureDb, registerHostedHeaders, registerHostedRenderLoader, registerHostedNavigationState } from "./helpers/hosted-render-loader.mjs";
import { registerMainHostedBaseline } from "./helpers/hosted-chrome-regression.mjs";

const loader = registerHostedRenderLoader();
const headers = registerHostedHeaders();
const state = { open: true, user: null };
const hooks = registerHostedNavigationState(state);
const baseline = registerMainHostedBaseline("4a71b1e");
test.after(() => { baseline.deregister(); hooks.deregister(); headers.deregister(); loader.deregister(); });
const { default: Layout } = await import("../src/app/p/[...segments]/layout.tsx");
const { default: Page, generateMetadata } = await import("../src/app/p/[...segments]/page.tsx");
const { default: RootLayout } = await import("../src/app/layout.tsx");
const { resolvePage } = await import("../src/lib/hosted-page-resolver.ts");
const { loadHostedRootVariants, loadHostedChildVariants } = await import("../src/lib/public-hosted-page.ts");
const { buildSitemapEntries, sitemapXml } = await import("../src/lib/sitemap-entries.ts");
const { hostedSwitcherVariants } = await import("../src/lib/hosted-page-urls.ts");
const { default: MainPage, generateMetadata: mainMetadata } = await import(baseline.moduleUrl("src/app/p/[...segments]/page.tsx"));
const { buildSitemapEntries: mainSitemap, sitemapXml: mainXml } = await import(baseline.moduleUrl("src/lib/sitemap-entries.ts"));

function row(locale: string, isDefault = true, child = false) {
  return { id: `${child ? "child" : "root"}-${locale}`, organizationId: "locale-fixture", slug: child ? "site-notes" : "locale-site",
    parentSlug: child ? "locale-site" : null, locale, isDefault, isPublished: true, title: `Title ${locale}`,
    metaTitle: `Meta ${locale}`, metaDescription: `Description ${locale}`, tagline: `Tagline ${locale}`,
    privacyPolicy: "隱私政策", termsOfService: "使用條款", canonicalUrl: null,
    headerLogo: null, heroImage: null, ogImage: null, template: "APP_LANDING", darkMode: false,
    hideFromNav: false, navOrder: null, themeColor: "#123456", content: { sections: [{ type: "about", order: 0, data: { text: "網頁內容" } }] },
    createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02") };
}
function request(locale: string | null, suffix = "") {
  const segments = ["locale-site", ...(locale ? [locale] : []), ...(suffix ? [suffix] : [])];
  fixtureDb.hostedPath = `/p/${segments.join("/")}`;
  return { params: Promise.resolve({ segments }) };
}
async function sitemap() {
  const roots = await loadHostedRootVariants("locale-site", "locale-fixture");
  const children = await loadHostedChildVariants("locale-fixture", "locale-site", "site-notes");
  return buildSitemapEntries([...roots, ...children].map(page => ({ ...page, updatedAt: "2026-01-02" })), [])
    .filter(entry => entry.url.includes("/p/"));
}
function localeLinks(html: string) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(EN|ES|繁中|简中)<\/a>/g)].map(match => ({ href: match[1], label: match[2] }));
}

for (const locale of ["en", "zh-TW", "zh-CN", "es"]) {
  test(`${locale}-only: default URL, HTML language, switcher, canonical/hreflang and sitemap`, async () => {
    fixtureDb.rows = [row(locale), row(locale, true, true), { ...row("ja", false), isPublished: false }];
    // A single published locale never redirects to the visitor's other language.
    fixtureDb.acceptLanguage = "ja, en;q=0.9, zh-CN;q=0.8";
    for (const suffix of ["", "site-notes", "privacy", "terms"]) {
      const props = request(null, suffix);
      const path = fixtureDb.hostedPath;
      const meta = await generateMetadata(props);
      assert.deepEqual(meta.alternates, { canonical: `https://appai.info${path}`, languages: {
        [locale]: `https://appai.info${path}`, "x-default": `https://appai.info${path}`,
      } });
      assert.equal(meta.robots, undefined);
      assert.equal(meta.openGraph?.locale, locale);
      const body = await Page(props);
      const html = await renderHtml(await Layout({ ...props, children: body }));
      const document = await RootLayout({ children: null });
      assert.equal(document.props.lang, locale, "actual html element uses resolved content locale");
      assert.match(html, new RegExp(`lang="${locale}"`));
      const links = localeLinks(html);
      assert.equal(links.length, locale.startsWith("zh-") ? 4 : 0, "desktop + open drawer");
      for (const link of links) {
        const linked = { params: Promise.resolve({ segments: link.href.slice(3).split("/") }) };
        await Page(linked); // Every choice must resolve, including policies/children.
        const linkedMeta = await generateMetadata(linked);
        assert.equal(linkedMeta.openGraph?.locale, link.label === "繁中" ? "zh-TW" : "zh-CN");
      }
    }
    const entries = await sitemap();
    assert.deepEqual(entries.map(entry => entry.url), ["", "/privacy", "/site-notes", "/terms"].map(suffix => `https://appai.info/p/locale-site${suffix}`));
    for (const entry of entries) assert.deepEqual(entry.alternates?.languages, { [locale]: entry.url, "x-default": entry.url });
    fixtureDb.acceptLanguage = "";
  });
}

test("derived Chinese pages retain noindex and self canonical; alternates and sitemap contain stored locales only", async () => {
  for (const source of ["zh-TW", "zh-CN"]) {
    const target = source === "zh-TW" ? "zh-CN" : "zh-TW";
    fixtureDb.rows = [row(source), row(source, true, true)];
    for (const suffix of ["", "site-notes", "privacy", "terms"]) {
      const props = request(target, suffix);
      const meta = await generateMetadata(props);
      const defaultUrl = `https://appai.info/p/locale-site${suffix ? `/${suffix}` : ""}`;
      assert.deepEqual(meta.robots, { index: false, follow: true });
      assert.deepEqual(meta.alternates, { canonical: `https://appai.info${fixtureDb.hostedPath}`, languages: {
        [source]: defaultUrl, "x-default": defaultUrl,
      } });
      assert.equal((await RootLayout({ children: null })).props.lang, target);
      const html = await renderHtml(await Layout({ ...props, children: await Page(props) }));
      assert.match(html, /自動轉換|自动转换/);
      assert.ok(localeLinks(html).some(link => link.href === defaultUrl.replace("https://appai.info", "")), "return to source locale");
    }
    assert.doesNotMatch(JSON.stringify(await sitemap()), new RegExp(`/${target}`));
  }
});

test("missing locales remain 404 for root, children and policies, without fictitious metadata", async () => {
  for (const locale of ["en", "zh-TW", "es"]) {
    fixtureDb.rows = [row(locale), row(locale, true, true)];
    for (const suffix of ["", "site-notes", "privacy", "terms"]) {
      const props = request("ja", suffix);
      await assert.rejects(() => Page(props), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
      assert.deepEqual(await generateMetadata(props), {});
    }
  }
});

test("switcher omits empty policies and unreachable child locales, including derived scripts", async () => {
  fixtureDb.rows = [row("en"), { ...row("zh-TW", false), privacyPolicy: "", termsOfService: "" }, row("en", true, true), row("es", false, true)];
  for (const suffix of ["privacy", "terms", "site-notes"]) {
    const props = request(null, suffix);
    assert.deepEqual(localeLinks(await renderHtml(await Layout({ ...props, children: null }))), []);
  }
  fixtureDb.rows = [row("en"), row("zh-TW", false), row("zh-TW", true, true)];
  const props = request(null, "site-notes");
  assert.equal((await RootLayout({ children: null })).props.lang, "zh-TW", "child has its own default");
  const links = localeLinks(await renderHtml(await Layout({ ...props, children: await Page(props) })));
  assert.equal(links.length, 4);
  for (const link of links) await Page({ params: Promise.resolve({ segments: link.href.slice(3).split("/") }) });
});

test("locale-free reader prefers published default, then oldest published row, then id", async () => {
  fixtureDb.rows = [{ ...row("es", false), createdAt: new Date("2026-01-02") }, row("zh-TW", false), { ...row("en"), isPublished: false }];
  assert.equal((await resolvePage("locale-site", null))?.locale, "zh-TW");
  const meta = await generateMetadata(request(null));
  assert.equal(meta.alternates?.canonical, "https://appai.info/p/locale-site/zh-TW");
  assert.deepEqual(meta.alternates?.languages, {
    es: "https://appai.info/p/locale-site/es", "zh-TW": "https://appai.info/p/locale-site/zh-TW",
  });
  const entries = await sitemap();
  assert.ok(entries.every(entry => entry.url !== "https://appai.info/p/locale-site"));
  assert.ok(entries.every(entry => !("x-default" in (entry.alternates?.languages ?? {}))));
  fixtureDb.rows[0].isDefault = true;
  assert.equal((await resolvePage("locale-site", null))?.locale, "es");
  fixtureDb.rows = [{ ...row("es", false), id: "b" }, { ...row("en", false), id: "a" }];
  assert.equal((await resolvePage("locale-site", null))?.locale, "en");
});

test("Chinese switcher source preference agrees with the reader even when source policies differ", async () => {
  const hk = { ...row("zh-HK"), privacyPolicy: "香港政策" };
  const tw = { ...row("zh-TW", false), privacyPolicy: "" };
  fixtureDb.rows = [hk, tw];
  assert.ok(!hostedSwitcherVariants([hk, tw], [hk, tw], "privacy").some(v => v.locale === "zh-CN"), "exact opposite wins over a default alias");
  assert.equal((await resolvePage("locale-site", "zh-CN"))?.privacyPolicy, "");
  const hant = { ...row("zh-Hant", false), privacyPolicy: "" };
  fixtureDb.rows = [hant, hk];
  assert.ok(hostedSwitcherVariants([hant, hk], [hant, hk], "privacy").some(v => v.locale === "zh-CN"), "alias fallback uses locale order, not UI order");
  assert.equal((await resolvePage("locale-site", "zh-CN"))?.privacyPolicy, "香港政策");
});

test("multi-locale metadata, page-body HTML/JSON-LD and sitemap XML are byte-identical to main 4a71b1e", async () => {
  fixtureDb.acceptLanguage = "";
  for (const locales of [["en", "zh-TW", "zh-CN", "es"], ["es", "en"], ["en", "zh-TW"]]) {
    const pages = locales.flatMap((locale, index) => [row(locale, index === 0), row(locale, index === 0, true)]);
    fixtureDb.rows = pages;
    for (const locale of [null, ...locales, ...(locales.includes("zh-TW") ? ["zh-CN"] : [])]) {
      for (const suffix of ["", "site-notes", "privacy", "terms"]) {
        const props = request(locale, suffix);
        assert.equal(JSON.stringify(await generateMetadata(props)), JSON.stringify(await mainMetadata(props)));
        assert.equal(await renderHtml(await Page(props)), await renderHtml(await MainPage(props)), `${locale}/${suffix}`);
      }
    }
    assert.equal(sitemapXml(buildSitemapEntries(pages, [])), mainXml(mainSitemap(pages, [])));
  }
});
