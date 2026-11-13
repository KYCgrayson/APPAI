import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createRequire } from "node:module";
import { hostedChromeBrowser } from "./helpers/hosted-chrome-browser.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { page, app } from "./fixtures/pr5-pages.ts";
import { fixtureDb, registerHostedRenderLoader, registerHostedHeaders, registerDirectoryFixtures, registerBreadcrumbNavigation, registerAuthRenderState } from "./helpers/hosted-render-loader.mjs";
import { registerMainHostedBaseline } from "./helpers/hosted-chrome-regression.mjs";
import { hostedNavigationCopy } from "../src/lib/hosted-navigation-copy.ts";

const authState = { code: "QA-CODE" as string | null, state: "loading" };
const hooks = [registerHostedRenderLoader(), registerHostedHeaders(), registerDirectoryFixtures({ translated: true }), registerBreadcrumbNavigation(), registerAuthRenderState(authState)];
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
  return schemas.flatMap(schema => Array.isArray(schema) ? schema : schema["@graph"] ?? [schema]).find(schema => schema["@type"] === "BreadcrumbList");
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
    fixtureDb.apps = [app("hosted-crumb", "crumb-site")];
    const prefix = locale === "en" ? "" : "/zh-TW";
    const category = locale === "en" ? "Websites" : "網站";
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
      trail(html, ["AppAI", category, rootName, ...(suffix ? [title] : [])], [`${prefix}/`, `${prefix}/websites`, ...(suffix ? [rootPath] : [])], locale === "en" ? "Breadcrumb" : "導覽路徑");
      const ld = breadcrumbLd(html);
      {
        assert.deepEqual(ld.itemListElement.map((item: { name: string }) => item.name), ["AppAI", category, rootName, ...(suffix ? [title] : [])]);
        assert.deepEqual(ld.itemListElement.map((item: { item: string }) => new URL(item.item).pathname), [`${prefix}/`, `${prefix}/websites`, rootPath, ...(suffix ? [fixtureDb.hostedPath] : [])]);
        assert.deepEqual(ld.itemListElement.map((item: { position: number }) => item.position), suffix ? [1, 2, 3, 4] : [1, 2, 3]);
        assert.ok(html.indexOf('data-breadcrumb=') > html.indexOf('</header>'));
        if (html.includes("<h1")) assert.ok(html.indexOf('data-breadcrumb=') < html.indexOf('<h1'));
        else assert.ok(html.indexOf('data-breadcrumb=') < html.indexOf('Fixture content'));
      }
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
    const detailNav = trail(detail, ["AppAI", locale === "en" ? "Websites" : "網站", locale === "en" ? "My app" : "我的應用"], [`${prefix}/`, `${prefix}/websites`], label)!;
    assert.match(detailNav, /background-color:transparent;color:#374151;--breadcrumb-link:#1f2937/);
    assert.match(detail, /<\/header><div class="max-w-3xl mx-auto px-6 pt-4 pb-12"><nav[^>]*data-breadcrumb="platform"/);
    const { default: FeedbackPage } = await import("../src/app/[locale]/feedback/page.tsx");
    const feedback = await renderHtml(await FeedbackPage());
    const feedbackNav = trail(feedback, ["AppAI", locale === "en" ? "Feedback" : "意見回饋"], [`${prefix}/`], label)!;
    assert.match(feedbackNav, /background-color:transparent;color:#374151;--breadcrumb-link:#1f2937/);
    assert.match(feedback, /<\/header><main class="max-w-xl mx-auto px-6 pt-4 pb-16"><nav[^>]*data-breadcrumb="platform"/);
    trail(await renderHtml(await PlatformHome()), ["AppAI"], [], label);
    for (const [path, slug] of [["games", undefined], ["games/[slug]", "water-pouring"], ["games/[slug]", "tabletop-puzzles"]]) {
      const { default: GamePage } = await import(`../src/app/[locale]/${path}/page.tsx`);
      const html = await renderHtml(await GamePage({ params: Promise.resolve({ locale, slug }) }));
      const { gameBreadcrumbs } = await import("../src/lib/games-page-seo.ts");
      const items = gameBreadcrumbs(locale, slug);
      trail(html, items.map(item => item.name), items.slice(0, -1).map(item => prefix + item.href), label);
    }
  });
}

test("a default child in another locale links to that locale's root", async () => {
  fixtureDb.apps = [];
  fixtureDb.rows = [page("mixed-site", { title: "English root" }),
    page("mixed-site", { id: "root-tw", locale: "zh-TW", isDefault: false, title: "繁體根頁" }),
    page("contact", { parentSlug: "mixed-site", locale: "zh-TW", isDefault: true, title: "聯絡我們" })];
  const html = await renderHtml(await HostedPage({ params: Promise.resolve({ segments: ["mixed-site", "contact"] }) }));
  trail(html, ["AppAI", "繁體根頁", "聯絡我們"], ["/zh-TW/", "/p/mixed-site/zh-TW"], "導覽路徑");
  assert.deepEqual(breadcrumbLd(html).itemListElement.map((item: { item: string }) => new URL(item.item).pathname), ["/zh-TW/", "/p/mixed-site/zh-TW", "/p/mixed-site/contact"]);
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
    trail(html, ["AppAI", rootName, title], [locale === "en" ? "/" : "/zh-TW/", "/p/tool-site"], locale === "en" ? "Breadcrumb" : "導覽路徑");
    assert.deepEqual(breadcrumbLd(html).itemListElement.map((item: { name: string }) => item.name), ["AppAI", rootName, title]);
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

for (const locale of ["en", "zh-TW"]) {
  test(`${locale}: auth pages render compact trails in existing padding`, async () => {
    fixtureDb.locale = locale;
    const prefix = locale === "en" ? "" : "/zh-TW";
    const label = locale === "en" ? "Breadcrumb" : "導覽路徑";
    const messages = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), "utf8"));
    for (const [path, key] of [["login", "signIn"], ["logout", "signOut"], ["auth/device", "deviceAuth"]]) {
      const { default: Page } = await import(`../src/app/[locale]/${path}/page.tsx`);
      for (const state of path === "auth/device" ? ["missing", "loading", "needLogin", "ready", "approving", "done", "denied", "error"] : ["loading"]) {
        authState.code = state === "missing" ? null : "QA-CODE";
        authState.state = state;
        const html = await renderHtml(await Page({ searchParams: Promise.resolve({}) }));
        const nav = trail(html, ["AppAI", messages.breadcrumbs[key]], [`${prefix}/`], label)!;
        assert.match(nav, /absolute inset-x-8 top-0/);
        assert.doesNotMatch(html, /<header/);
        assert.match(html, /class="relative [^"]*p-8[^"]*"/);
      }
      // Positioning establishes a containing block but contributes no flow height.
      const file = `src/app/[locale]/${path}/page.tsx`;
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      const main = execFileSync("git", ["show", `5379be0:${file}`], { encoding: "utf8" });
      const classes = (input: string) => [...input.matchAll(/className="([^"]*)"/g)].map(match => match[1].replace(/^relative /, ""));
      assert.deepEqual(classes(source), classes(main), `${path}: flow dimensions unchanged from #73`);
    }
  });
}

test("all nine platform breadcrumb landmarks describe navigation rather than the current page", () => {
  for (const locale of ["en", "zh-TW", "zh-CN", "ja", "ko", "de", "es", "fr", "hi"]) {
    const messages = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), "utf8"));
    assert.equal(messages.breadcrumbs.label, locale === "hi" ? "पेज का रास्ता" : hostedNavigationCopy(locale).breadcrumb, locale);
  }
});

test("management pages include AppAI and English overview/sub-page labels", async () => {
  for (const [area, name, pages] of [
    ["dashboard", "Dashboard", { pages: "Pages", publisher: "Publisher", settings: "API Keys", tools: "Tools" }],
    ["admin", "Admin", { pages: "Pages", apps: "Apps", analytics: "Analytics", "universal-apps": "Universal Releases", users: "Users", feedback: "Feedback", usage: "Tool Usage" }],
  ] as const) {
    for (const [segment, label] of Object.entries(pages)) {
      fixtureDb.hostedPath = `/${area}/${segment}`;
      for (const locale of ["en", "zh-TW"]) {
        const homeHref = locale === "en" ? "/" : "/zh-TW/";
        trail(await renderHtml(ManagementBreadcrumb({ area, homeHref })), ["AppAI", name, label], [homeHref, `/${area}`]);
      }
    }
    fixtureDb.hostedPath = `/${area}`;
    for (const homeHref of ["/", "/zh-TW/"]) trail(await renderHtml(ManagementBreadcrumb({ area, homeHref })), ["AppAI", name], [homeHref]);
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
  trail(await renderHtml(await NotFound()), ["AppAI", "Site", "Page not found"], ["/", "/p/crumb-site"]);
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

for (const locale of ["en", "zh-TW"]) {
  test(`${locale}: hosted categories and app detail use the directory classification`, async () => {
    fixtureDb.locale = locale;
    const prefix = locale === "en" ? "" : "/zh-TW";
    const copy = hostedNavigationCopy(locale);
    for (const [tag, kind] of [["website", "websites"], ["tool", "tools"], ["app", "apps"], ["game", "games"]] as const) {
      fixtureDb.rows = [page("listed-site", { title: "Site" }), page("listed-site", { id: "tw", locale: "zh-TW", isDefault: false, title: "網站", content: { sections: [{ type: "download" }] } })];
      fixtureDb.apps = [app("listed-app", "listed-site", { tags: [`appai:kind:${tag}`] })];
      const site = locale === "en" ? "Site" : "網站";
      const html = await renderHtml(await HostedPage({ params: Promise.resolve({ segments: ["listed-site", ...(locale === "en" ? [] : [locale])] }) }));
      trail(html, ["AppAI", copy[kind], site], [`${prefix}/`, `${prefix}/${kind}`], copy.breadcrumb);
      assert.deepEqual(breadcrumbLd(html).itemListElement.map((item: { name: string }) => item.name), ["AppAI", copy[kind], site]);
      const detail = await renderHtml(await AppDetail({ params: Promise.resolve({ locale, id: "listed-app" }) }));
      const messages = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), "utf8"));
      trail(detail, ["AppAI", messages.breadcrumbs[kind], site], [`${prefix}/`, `${prefix}/${kind}`], copy.breadcrumb);
      const ld = breadcrumbLd(detail).itemListElement;
      assert.deepEqual(ld.map((item: { name: string }) => item.name), ["AppAI", messages.breadcrumbs[kind], site]);
      assert.deepEqual(ld.map((item: { item: string }) => new URL(item.item).pathname), [prefix || "/", `${prefix}/${kind}`, `${prefix}/apps/listed-app`]);
    }
  });

  test(`${locale}: unlisted hosted sites never link to a category`, async () => {
    fixtureDb.locale = locale;
    const prefix = locale === "en" ? "" : "/zh-TW";
    const copy = hostedNavigationCopy(locale);
    for (const reason of ["no app", "unapproved", "foreign organization", "child binding", "personal profile"]) {
      fixtureDb.rows = [page("unlisted", { locale, title: "Site", template: reason === "personal profile" ? "PERSON" : "APP_LANDING" }), page("contact", { locale, parentSlug: "unlisted", title: "Contact" })];
      fixtureDb.apps = reason === "no app" ? [] : [app("unlisted-app", reason === "child binding" ? "contact" : "unlisted", {
        isApproved: reason !== "unapproved", organizationId: reason === "foreign organization" ? "org-b" : "org-a",
      })];
      for (const child of [false, true]) {
        const html = await renderHtml(await HostedPage({ params: Promise.resolve({ segments: ["unlisted", ...(child ? ["contact"] : [])] }) }));
        const names = ["AppAI", "Site", ...(child ? ["Contact"] : [])];
        trail(html, names, [`${prefix}/`, ...(child ? ["/p/unlisted"] : [])], copy.breadcrumb);
        assert.deepEqual(breadcrumbLd(html).itemListElement.map((item: { name: string }) => item.name), names, reason);
      }
    }
  });
}

test("hosted locale matching bridges nine platform locales and ignores draft classification signals", async () => {
  for (const [locale, prefix, category] of [["ja-JP", "/ja", "ウェブサイト"], ["pt-BR", "", "Websites"], ["zh-TW", "/zh-TW", "網站"], ["hi-IN", "/hi", "वेबसाइट"]]) {
    fixtureDb.rows = [page("locale-site", { locale, title: "Site" }), page("locale-site", { id: "draft", locale: "en", isDefault: false, isPublished: false, template: "GAME", content: { sections: [{ type: "iframe-tool" }] } })];
    fixtureDb.apps = [app("locale-app", "locale-site")];
    const html = await renderHtml(await HostedPage({ params: Promise.resolve({ segments: ["locale-site"] }) }));
    trail(html, ["AppAI", category, "Site"], [`${prefix}/`, `${prefix}/websites`], hostedNavigationCopy(locale).breadcrumb);
  }
});

test("hosted root output differs from shipped #73 only by its breadcrumb row and matching JSON-LD", async () => {
  const baseline = registerMainHostedBaseline("5379be0");
  try {
    const { default: MainPage } = await import(baseline.moduleUrl("src/app/p/[...segments]/page.tsx"));
    const { default: MainLayout } = await import(baseline.layoutUrl);
    for (const locale of ["en", "zh-TW"]) for (const template of ["APP_LANDING", "COMPANY_PROFILE", "LINK_IN_BIO", "PERSON", "GAME"]) {
      fixtureDb.rows = [page("root-regression", { locale, title: "Site", template })];
      fixtureDb.apps = [app("root-regression", "root-regression")];
      const params = Promise.resolve({ segments: ["root-regression"] });
      const current = await renderHtml(await HostedLayout({ params, children: await HostedPage({ params }) }));
      const main = await renderHtml(await MainLayout({ params, children: await MainPage({ params }) }));
      const nav = /<nav\b[^>]*data-breadcrumb="hosted"[^>]*>[\s\S]*?<\/nav>/g;
      assert.equal([...current.matchAll(nav)].length, 1);
      assert.equal(current.match(/<header\b[\s\S]*?<\/header>/)![0], main.match(/<header\b[\s\S]*?<\/header>/)![0]);
      assert.doesNotMatch(current.match(/<header\b[\s\S]*?<\/header>/)![0], /<svg[^>]*class="[^"]*lucide-house/);
      const normalized = current.replace(nav, "").replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (script: string, open: string, json: string, close: string) => {
        const data = JSON.parse(json);
        if (!data["@graph"]) return script;
        assert.equal(data["@graph"].filter((item: { "@type": string }) => item["@type"] === "BreadcrumbList").length, 1);
        data["@graph"] = data["@graph"].filter((item: { "@type": string }) => item["@type"] !== "BreadcrumbList");
        return open + JSON.stringify(data) + close;
      });
      assert.equal(normalized, main, `${locale}/${template}`);
    }
  } finally { baseline.deregister(); }
});

test("spec endpoints serve plain text rather than HTML layouts", async () => {
  const { GET } = await import("../src/app/spec/route.ts");
  const { GET: Topic } = await import("../src/app/spec/[topic]/route.ts");
  for (const response of [await GET(), await Topic(new Request("https://appai.info/spec/pages"), { params: Promise.resolve({ topic: "pages" }) })]) {
    assert.match(response.headers.get("content-type")!, /^text\/plain/);
    assert.doesNotMatch(await response.text(), /data-breadcrumb=/);
  }
});

test("compiled auth CSS reserves 28px inside the existing 32px padding with zero flow-height delta", async (t) => {
  const require = createRequire(import.meta.url);
  const cssPath = new URL("../src/app/globals.css", import.meta.url).pathname;
  const cssSource = readFileSync(cssPath, "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../";');
  const result = await require("postcss")([require("@tailwindcss/postcss")({ optimize: true })]).process(cssSource, { from: cssPath });
  const declarations = (selector: string) => {
    const found: Record<string, string> = {};
    result.root.walkRules((rule: { selector: string; walkDecls: (callback: (decl: { prop: string; value: string }) => void) => void }) => {
      if (rule.selector.split(",").map(value => value.trim()).includes(selector)) rule.walkDecls(decl => { found[decl.prop] = decl.value; });
    });
    return found;
  };
  assert.equal(declarations(".absolute").position, "absolute");
  assert.equal(declarations(".relative").position, "relative");
  assert.equal(declarations(".top-0").top, "calc(var(--spacing)*0)");
  assert.equal(declarations(".h-7").height, "calc(var(--spacing)*7)");
  assert.equal(declarations(".p-8").padding, "calc(var(--spacing)*8)");
  assert.match(result.css, /--spacing:\s*\.25rem/);
  const auth = readFileSync(new URL("../src/components/AuthBreadcrumb.tsx", import.meta.url), "utf8");
  assert.match(auth, /absolute inset-x-8 top-0 h-7/);
  assert.match(auth, /\[scrollbar-width:none\] \[&::-webkit-scrollbar\]:hidden/);
  t.diagnostic("At the default 16px root: row 7×4=28px; existing padding 8×4=32px; 4px clearance; absolute positioning adds 0px flow/scroll height.");
});

test("auth scroll height matches shipped #73 with compiled CSS at desktop and mobile widths", {
  skip: process.env.AUTH_BREADCRUMB_BROWSER_TESTS !== "1" ? "Opt in with AUTH_BREADCRUMB_BROWSER_TESTS=1 and existing Chrome." : false,
}, async (t) => {
  const require = createRequire(import.meta.url);
  const cssPath = new URL("../src/app/globals.css", import.meta.url).pathname;
  const cssSource = readFileSync(cssPath, "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../";');
  const css = (await require("postcss")([require("@tailwindcss/postcss")({ optimize: true })]).process(cssSource, { from: cssPath })).css;
  const baseline = registerMainHostedBaseline("5379be0", ["@/i18n/navigation", "@/lib/universal-apps/runtime-session"]);
  const browser = await hostedChromeBrowser(process.env.HOSTED_CHROME_BINARY || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  let comparisons = 0;
  try {
    for (const locale of ["en", "zh-TW"]) for (const path of ["login", "logout", "auth/device"]) {
      fixtureDb.locale = locale;
      const source = `src/app/[locale]/${path}/page.tsx`;
      const { default: Current } = await import(new URL(`../${source}`, import.meta.url).href);
      const { default: Main } = await import(baseline.moduleUrl(source));
      for (const state of path === "auth/device" ? ["missing", "loading", "needLogin", "ready", "approving", "done", "denied", "error"] : ["loading"]) {
        authState.code = state === "missing" ? null : "QA-CODE";
        authState.state = state;
        const props = { searchParams: Promise.resolve({}) };
        const current = await renderHtml(await Current(props));
        const main = await renderHtml(await Main(props));
        for (const [width, height] of [[320, 568], [375, 667], [1280, 800], [320, 240]]) {
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
          const metrics = [];
          for (const html of [main, current]) {
            await browser.send("Page.setDocumentContent", { frameId: (await browser.send("Page.getFrameTree")).frameTree.frame.id,
              html: `<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>` });
            metrics.push(await browser.evaluate(`(() => {
              const nav = document.querySelector('[data-breadcrumb]');
              const card = nav?.parentElement;
              return { scroll: document.documentElement.scrollHeight, body: document.body.scrollHeight,
                rowHeight: nav?.getBoundingClientRect().height ?? 0,
                padding: card ? parseFloat(getComputedStyle(card).paddingTop) : 0,
                rowBottom: nav?.getBoundingClientRect().bottom ?? 0,
                contentTop: nav?.nextElementSibling?.getBoundingClientRect().top ?? 0 };
            })()`));
          }
          const context = `${locale}/${path}/${state} at ${width}×${height}`;
          assert.equal(metrics[1].scroll, metrics[0].scroll, context);
          assert.equal(metrics[1].body, metrics[0].body, context);
          assert.ok(metrics[1].rowHeight <= metrics[1].padding, context);
          assert.ok(metrics[1].rowBottom <= metrics[1].contentTop, `${context}: no content overlap`);
          comparisons++;
        }
      }
    }
    t.diagnostic(`${comparisons} comparisons; maximum extra document/body scroll height: 0px; breadcrumb row fits existing top padding without overlap.`);
  } finally { await browser.close(); baseline.deregister(); }
});
