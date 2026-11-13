import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderHtml } from "./helpers/render-html.mjs";
import { page, app } from "./fixtures/pr5-pages.ts";
import { fixtureDb, registerHostedRenderLoader, registerHostedHeaders, registerDirectoryFixtures, registerBreadcrumbNavigation } from "./helpers/hosted-render-loader.mjs";

const hooks = [registerHostedRenderLoader(), registerHostedHeaders(), registerDirectoryFixtures({ translated: true }), registerBreadcrumbNavigation()];
test.after(() => hooks.reverse().forEach(hook => hook.deregister()));
const { default: HostedPage } = await import("../src/app/p/[...segments]/page.tsx");
const { default: HostedLayout } = await import("../src/app/p/[...segments]/layout.tsx");
const { default: NotFound } = await import("../src/app/not-found.tsx");
const { PlatformHeader } = await import("../src/components/PlatformHeader.tsx");
const { Breadcrumb } = await import("../src/components/Breadcrumb.tsx");
const { ManagementBreadcrumb } = await import("../src/components/ManagementBreadcrumb.tsx");
const { default: AppDetail } = await import("../src/app/[locale]/apps/[id]/page.tsx");
const { default: PlatformHome } = await import("../src/app/[locale]/page.tsx");

function trail(html: string, names: string[], hrefs: string[], label = "Breadcrumb") {
  const navs = [...html.matchAll(/<nav\b[^>]*data-breadcrumb="[^"]+"[^>]*>[\s\S]*?<\/nav>/g)];
  assert.equal(navs.length, names.length ? 1 : 0);
  if (!names.length) return;
  const nav = navs[0][0];
  assert.ok(nav.includes(`aria-label="${label}"`));
  assert.deepEqual([...nav.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(match => match[1].replace(/<[^>]*>/g, "").replace(/^›/, "")), names);
  assert.deepEqual([...nav.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map(match => match[1]), hrefs);
  assert.equal([...nav.matchAll(/aria-current="page"/g)].length, 1);
  assert.match(nav, /<span aria-current="page"/);
  assert.doesNotMatch(nav, /<a\b[^>]*aria-current/);
  assert.equal([...nav.matchAll(/aria-hidden="true">›/g)].length, names.length - 1);
  assert.match(nav, /overflow-x-auto/);
  assert.match(nav, /<ol[^>]*flex-nowrap[^>]*whitespace-nowrap/);
  assert.doesNotMatch(nav, /flex-wrap/);
  for (const [anchor] of nav.matchAll(/<a\b[^>]*>/g)) assert.match(anchor, /min-h-6/);
  return nav;
}

function breadcrumbLd(html: string) {
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  return schemas.flatMap(schema => schema["@graph"] ?? [schema]).find(schema => schema["@type"] === "BreadcrumbList");
}

for (const locale of ["en", "zh-TW"]) {
  test(`${locale}: hosted child/contact, policies, 404 and root trails share JSON-LD`, async () => {
    const rootName = locale === "en" ? "Fixture site" : "範例網站";
    const contact = locale === "en" ? "Contact" : "聯絡我們";
    fixtureDb.rows = ["en", "zh-TW"].flatMap(lang => [
      page("crumb-site", { id: `root-${lang}`, locale: lang, isDefault: lang === "en", title: lang === "en" ? "Fixture site" : "範例網站" }),
      page("contact", { id: `contact-${lang}`, parentSlug: "crumb-site", locale: lang, isDefault: lang === "en", title: lang === "en" ? "Contact" : "聯絡我們", canonicalUrl: "https://example.com/contact" }),
      page("faq", { id: `faq-${lang}`, parentSlug: "crumb-site", locale: lang, isDefault: lang === "en", title: lang === "en" ? "FAQ" : "常見問題" }),
    ]);
    const rootPath = `/p/crumb-site${locale === "en" ? "" : "/zh-TW"}`;
    const expected = [
      ["contact", contact], ["faq", locale === "en" ? "FAQ" : "常見問題"],
      ["privacy", locale === "en" ? "Privacy Policy" : "隱私權政策"],
      ["terms", locale === "en" ? "Terms of Service" : "服務條款"],
      ["missing", locale === "en" ? "Page not found" : "找不到頁面"], ["", ""],
    ];
    for (const [suffix, title] of expected) {
      fixtureDb.hostedPath = rootPath + (suffix ? `/${suffix}` : "");
      const params = Promise.resolve({ segments: fixtureDb.hostedPath.slice(3).split("/") });
      let children;
      if (suffix === "missing") {
        await assert.rejects(() => HostedPage({ params }), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
        children = await NotFound();
      } else children = await HostedPage({ params });
      const html = await renderHtml(await HostedLayout({ params, children }));
      trail(html, suffix ? [rootName, title] : [], suffix ? [rootPath] : [], locale === "en" ? "Breadcrumb" : "導覽路徑");
      const ld = breadcrumbLd(html);
      if (suffix) {
        assert.deepEqual(ld.itemListElement.map((item: { name: string }) => item.name), [rootName, title]);
        assert.deepEqual(ld.itemListElement.map((item: { item: string }) => new URL(item.item).pathname), [rootPath, fixtureDb.hostedPath]);
        assert.deepEqual(ld.itemListElement.map((item: { position: number }) => item.position), [1, 2]);
        assert.ok(html.indexOf('data-breadcrumb=') > html.indexOf('</header>'));
        if (html.includes("<h1")) assert.ok(html.indexOf('data-breadcrumb=') < html.indexOf('<h1'));
        else assert.ok(html.indexOf('data-breadcrumb=') < html.indexOf('Fixture content'));
      } else assert.equal(ld, undefined);
      if (["privacy", "terms"].includes(suffix)) assert.doesNotMatch(html, /text-gray-500 mb-6 md:mb-8 flex-wrap/);
    }
  });

  test(`${locale}: platform directories, app detail, auth/support and home`, async () => {
    fixtureDb.locale = locale;
    fixtureDb.rows = [page("public-app", { title: "My app" }), page("public-app", { id: "tw", locale: "zh-TW", isDefault: false, title: "我的應用" })];
    fixtureDb.apps = [app("app-crumb", "public-app")];
    const prefix = locale === "en" ? "" : "/zh-TW";
    const label = locale === "en" ? "Breadcrumb" : "導覽路徑";
    for (const [section, name] of Object.entries(locale === "en" ? { apps: "Apps", websites: "Websites", tools: "Tools", games: "Games" } : { apps: "應用程式", websites: "網站", tools: "工具", games: "遊戲" })) {
      const { default: Directory } = await import(`../src/app/[locale]/${section}/page.tsx`);
      const html = await renderHtml(await Directory({ searchParams: Promise.resolve({}) }));
      trail(html, ["AppAI", name], [`${prefix}/`], label);
      assert.match(html, /<\/header><nav[^>]*data-breadcrumb="platform"/);
    }
    const detail = await renderHtml(await AppDetail({ params: Promise.resolve({ locale, id: "app-crumb" }) }));
    trail(detail, ["AppAI", locale === "en" ? "Apps" : "應用程式", locale === "en" ? "My app" : "我的應用"], [`${prefix}/`, `${prefix}/apps`], label);
    const pages = locale === "en" ? { signIn: "Sign in", signOut: "Sign out", feedback: "Feedback", deviceAuth: "Device authorization" } : { signIn: "登入", signOut: "登出", feedback: "意見回饋", deviceAuth: "裝置授權" };
    for (const [pageLabel, name] of Object.entries(pages)) {
      trail(await renderHtml(await PlatformHeader({ pageLabel: pageLabel as "signIn" })), ["AppAI", name], [`${prefix}/`], label);
    }
    trail(await renderHtml(await PlatformHome()), [], []);
  });
}

test("a default child in another locale links to that locale's root", async () => {
  fixtureDb.rows = [page("mixed-site", { title: "English root" }),
    page("mixed-site", { id: "root-tw", locale: "zh-TW", isDefault: false, title: "繁體根頁" }),
    page("contact", { parentSlug: "mixed-site", locale: "zh-TW", isDefault: true, title: "聯絡我們" })];
  const html = await renderHtml(await HostedPage({ params: Promise.resolve({ segments: ["mixed-site", "contact"] }) }));
  trail(html, ["繁體根頁", "聯絡我們"], ["/p/mixed-site/zh-TW"], "導覽路徑");
  assert.deepEqual(breadcrumbLd(html).itemListElement.map((item: { item: string }) => new URL(item.item).pathname), ["/p/mixed-site/zh-TW", "/p/mixed-site/contact"]);
});

test("fullscreen hosted tools keep a trail above either the frame or access gate", async () => {
  for (const locale of ["en", "zh-TW"]) for (const access of ["public", "login"]) {
    const rootName = locale === "en" ? "Tool site" : "工具網站";
    const title = locale === "en" ? "Subtitle tool" : "字幕工具";
    fixtureDb.rows = [page("tool-site", { locale, title: rootName, isDefault: true, content: { sections: [
      { type: "iframe-tool", order: 0, data: { src: "https://fixture.pages.dev", heading: title, access } },
    ] } })];
    fixtureDb.locale = locale;
    fixtureDb.hostedPath = "/p/tool-site/tools/0";
    const params = Promise.resolve({ segments: ["tool-site", "tools", "0"] });
    const html = await renderHtml(await HostedLayout({ params, children: await HostedPage({ params }) }));
    trail(html, [rootName, title], ["/p/tool-site"], locale === "en" ? "Breadcrumb" : "導覽路徑");
    assert.deepEqual(breadcrumbLd(html).itemListElement.map((item: { name: string }) => item.name), [rootName, title]);
    if (access === "public") assert.ok(html.indexOf('data-breadcrumb=') < html.indexOf('<iframe'));
    else assert.doesNotMatch(html, /<iframe/);
  }
});

test("static game play pages reuse the shared localized trail below their toolbar", async () => {
  const { NextRequest } = await import("next/server.js");
  const { GET } = await import("../src/app/games/[slug]/runtime/route.ts");
  for (const locale of ["en", "zh-TW"]) {
    const response = await GET(new NextRequest(`https://appai.info/games/water-pouring/play?locale=${locale}&game=water`), { params: Promise.resolve({ slug: "water-pouring" }) });
    const html = await response.text();
    const prefix = locale === "en" ? "" : "/zh-TW";
    trail(html, ["AppAI", locale === "en" ? "Games" : "遊戲", locale === "en" ? "Water Pouring" : "量水"], [`${prefix}/`, `${prefix}/games`], locale === "en" ? "Breadcrumb" : "導覽路徑");
    assert.match(html, /89px/);
    assert.match(html, /#appai-play-chrome ol\{[^}]*flex-wrap:nowrap/);
    assert.ok(html.indexOf('id="appai-play-nav"') < html.indexOf('data-breadcrumb='));
  }
});

test("management sub-pages have English trails and overview pages have none", async () => {
  for (const [area, name, pages] of [
    ["dashboard", "Dashboard", { pages: "Pages", publisher: "Publisher", settings: "API Keys", tools: "Tools" }],
    ["admin", "Admin", { pages: "Pages", apps: "Apps", analytics: "Analytics", "universal-apps": "Universal Releases", users: "Users", feedback: "Feedback", usage: "Tool Usage" }],
  ] as const) {
    for (const [segment, label] of Object.entries(pages)) {
      fixtureDb.hostedPath = `/${area}/${segment}`;
      trail(await renderHtml(ManagementBreadcrumb({ area })), [name, label], [`/${area}`]);
    }
    fixtureDb.hostedPath = `/${area}`;
    trail(await renderHtml(ManagementBreadcrumb({ area })), [], []);
    assert.match(readFileSync(new URL(`../src/app/${area}/layout.tsx`, import.meta.url), "utf8"), new RegExp(`<ManagementBreadcrumb area="${area}"`));
  }
});

test("unknown/unpublished roots never expose a breadcrumb; malformed known-root URLs retain one", async () => {
  fixtureDb.rows = [page("crumb-site", { title: "Site" }), page("private-site", { isPublished: false })];
  for (const path of ["/p/unknown/missing", "/p/private-site/missing", "/not-a-hosted-page"]) {
    fixtureDb.hostedPath = path;
    trail(await renderHtml(await NotFound()), [], []);
  }
  fixtureDb.hostedPath = "/p/crumb-site/too/many/segments";
  trail(await renderHtml(await NotFound()), ["Site", "Page not found"], ["/p/crumb-site"]);
});

function contrast(a: string, b: string) {
  const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(pair => parseInt(pair, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (values[1] + .05) / (values[0] + .05);
}

test("shared breadcrumbs retain AA contrast for theme colours in both modes", async () => {
  for (const dark of [false, true]) for (const red of [0, 64, 128, 192, 255]) for (const green of [0, 64, 128, 192, 255]) for (const blue of [0, 64, 128, 192, 255]) {
    const themeColor = `#${[red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("")}`;
    const html = await renderHtml(Breadcrumb({ items: [{ name: "Root", href: "/" }, { name: "Page", href: "/page" }], label: "Breadcrumb", dark, themeColor }));
    const background = html.match(/background-color:(#[a-f\d]{6})/)![1];
    assert.ok(contrast(html.match(/;color:(#[a-f\d]{6})/)![1], background) >= 4.5);
    assert.ok(contrast(html.match(/--breadcrumb-link:(#[a-f\d]{6})/)![1], background) >= 4.5, `${themeColor}, dark=${dark}`);
  }
});
