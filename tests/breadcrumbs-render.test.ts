import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { renderHtml } from "./helpers/render-html.mjs";
import { page, app } from "./fixtures/pr5-pages.ts";
import { fixtureDb, registerHostedRenderLoader, registerHostedHeaders, registerDirectoryFixtures, registerBreadcrumbNavigation } from "./helpers/hosted-render-loader.mjs";
import { registerMainHostedBaseline } from "./helpers/hosted-chrome-regression.mjs";
import { hostedNavigationCopy } from "../src/lib/hosted-navigation-copy.ts";

const hooks = [registerHostedRenderLoader(), registerHostedHeaders(), registerDirectoryFixtures({ translated: true }), registerBreadcrumbNavigation()];
test.after(() => hooks.reverse().forEach(hook => hook.deregister()));
const { default: HostedPage } = await import("../src/app/p/[...segments]/page.tsx");
const { default: HostedLayout } = await import("../src/app/p/[...segments]/layout.tsx");
const { default: NotFound } = await import("../src/app/not-found.tsx");
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

  test(`${locale}: platform directories, app detail, feedback and home`, async () => {
    fixtureDb.locale = locale;
    fixtureDb.rows = [page("public-app", { title: "My app" }), page("public-app", { id: "tw", locale: "zh-TW", isDefault: false, title: "我的應用" })];
    fixtureDb.apps = [app("app-crumb", "public-app")];
    const prefix = locale === "en" ? "" : "/zh-TW";
    const label = locale === "en" ? "Breadcrumb" : "導覽路徑";
    for (const [section, name] of Object.entries(locale === "en" ? { apps: "Apps", websites: "Websites", tools: "Tools" } : { apps: "應用程式", websites: "網站", tools: "工具" })) {
      const { default: Directory } = await import(`../src/app/[locale]/${section}/page.tsx`);
      const html = await renderHtml(await Directory({ searchParams: Promise.resolve({}) }));
      const nav = trail(html, ["AppAI", name], [`${prefix}/`], label)!;
      assert.match(nav, /background-color:transparent;color:#e5e7eb;--breadcrumb-link:#67e8f9/);
      assert.match(html, /<\/header><main class="max-w-6xl mx-auto px-6 pt-4 pb-8"><nav[^>]*data-breadcrumb="platform"/);
      assert.match(html.match(/<header\b[\s\S]*?<\/header>/)![0], /<span>AppAI<\/span>[\s\S]*aria-label="Main navigation"/);
    }
    const detail = await renderHtml(await AppDetail({ params: Promise.resolve({ locale, id: "app-crumb" }) }));
    const detailNav = trail(detail, ["AppAI", locale === "en" ? "Apps" : "應用程式", locale === "en" ? "My app" : "我的應用"], [`${prefix}/`, `${prefix}/apps`], label)!;
    assert.match(detailNav, /background-color:transparent;color:#374151;--breadcrumb-link:#1f2937/);
    assert.match(detail, /<\/header><div class="max-w-3xl mx-auto px-6 pt-4 pb-12"><nav[^>]*data-breadcrumb="platform"/);
    const { default: FeedbackPage } = await import("../src/app/[locale]/feedback/page.tsx");
    const feedback = await renderHtml(await FeedbackPage());
    const feedbackNav = trail(feedback, ["AppAI", locale === "en" ? "Feedback" : "意見回饋"], [`${prefix}/`], label)!;
    assert.match(feedbackNav, /background-color:transparent;color:#374151;--breadcrumb-link:#1f2937/);
    assert.match(feedback, /<\/header><main class="max-w-xl mx-auto px-6 pt-4 pb-16"><nav[^>]*data-breadcrumb="platform"/);
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

test("static game play pages preserve main's toolbar and viewport with no added trail", async () => {
  const baseline = registerMainHostedBaseline();
  try {
    const { NextRequest } = await import("next/server.js");
    const { GET } = await import("../src/app/games/[slug]/runtime/route.ts");
    const { GET: MainGET } = await import(baseline.moduleUrl("src/app/games/[slug]/runtime/route.ts"));
    for (const locale of ["en", "zh-TW"]) {
      const request = new NextRequest(`https://appai.info/games/water-pouring/play?locale=${locale}&game=water`);
      const params = Promise.resolve({ slug: "water-pouring" });
      const response = await GET(request, { params });
      const html = await response.text();
      assert.equal(html, await (await MainGET(request, { params })).text());
      trail(html, [], []);
      assert.doesNotMatch(html, /appai-play-chrome|89px/);
      assert.match(html, /id="appai-play-nav"/);
    }
  } finally { baseline.deregister(); }
});

test("auth flow layouts match main without added headers or breadcrumbs", () => {
  for (const path of ["login/page.tsx", "logout/page.tsx", "auth/device/page.tsx"]) {
    const file = `src/app/[locale]/${path}`;
    const current = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.equal(current, execFileSync("git", ["show", `main:${file}`], { encoding: "utf8" }));
    assert.doesNotMatch(current, /PlatformHeader|Breadcrumb/);
  }
  assert.equal(existsSync(new URL("../src/app/[locale]/auth/device/layout.tsx", import.meta.url)), false);
});

test("all nine platform breadcrumb landmarks describe navigation rather than the current page", () => {
  for (const locale of ["en", "zh-TW", "zh-CN", "ja", "ko", "de", "es", "fr", "hi"]) {
    const messages = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), "utf8"));
    assert.equal(messages.breadcrumbs.label, locale === "hi" ? "पेज का रास्ता" : hostedNavigationCopy(locale).breadcrumb, locale);
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
