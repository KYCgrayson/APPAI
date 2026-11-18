import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { locales } from "../src/i18n/routing.ts";
import { GAMES, TABLETOP_COLLECTION, getGamesCopy } from "../src/lib/games-catalog.ts";
import { getGamePageCopy, getGamesHubFaq } from "../src/lib/games-pages-copy.ts";
import { buildGamePageMetadata } from "../src/lib/games-page-seo.ts";
import { getDirectoryCopy } from "../src/lib/directory-copy.ts";
import { buildSitemapEntries, latestContentModified, PLATFORM_CONTENT_MODIFIED } from "../src/lib/sitemap-entries.ts";
import { SPEC_TOPICS } from "../src/lib/spec-topics.ts";
import { resolveHostedDescription, buildJsonLd } from "../src/lib/hosted-page-seo.ts";
import { checkPagePreview } from "../src/lib/page-preview.ts";
import { platformAlternates, platformUrl } from "../src/lib/platform-seo.ts";
import { renderHtml } from "./helpers/render-html.mjs";
import { registerHostedRenderLoader, registerHostedHeaders, registerDirectoryFixtures, registerAuthRenderState, fixtureDb } from "./helpers/hosted-render-loader.mjs";
import { registerMainHostedBaseline } from "./helpers/hosted-chrome-regression.mjs";

const loader = registerHostedRenderLoader();
const headers = registerHostedHeaders();
const intl = registerDirectoryFixtures({ translated: true });
const auth = registerAuthRenderState({ code: null, state: "loading" });
const baseline = registerMainHostedBaseline("3ddf782", ["@/i18n/navigation"]);
test.after(() => { baseline.deregister(); auth.deregister(); intl.deregister(); headers.deregister(); loader.deregister(); });
const hosted = await import("../src/app/p/[...segments]/page.tsx");
const oldHosted = await import(baseline.moduleUrl("src/app/p/[...segments]/page.tsx"));
const oldSeo = await import(baseline.moduleUrl("src/lib/hosted-page-seo.ts"));
const appDetail = await import("../src/app/[locale]/apps/[id]/page.tsx");
const oldAppDetail = await import(baseline.moduleUrl("src/app/[locale]/apps/[id]/page.tsx"));
const gameDetail = await import("../src/app/[locale]/games/[slug]/page.tsx");
const gameHub = await import("../src/app/[locale]/games/page.tsx");
const oldGameHub = await import(baseline.moduleUrl("src/app/[locale]/games/page.tsx"));
const oldGameDetail = await import(baseline.moduleUrl("src/app/[locale]/games/[slug]/page.tsx"));
const oldGameSeo = await import(baseline.moduleUrl("src/lib/games-page-seo.ts"));
const root = { id: "root", slug: "seo-fixture", parentSlug: null, organizationId: "fixture", locale: "en", isDefault: true,
  isPublished: true, title: "Fictional site", metaDescription: "  Original **description**  ", tagline: "Tagline", template: "APP_LANDING",
  privacyPolicy: "Privacy", termsOfService: "Terms", headerLogo: null, heroImage: null, ogImage: null, canonicalUrl: null,
  createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"), content: { sections: [{ type: "hero", data: { headline: "Fictional site", subheadline: "Public summary" } }] } };
const section = (type: string, data: Record<string, unknown>, order = 0) => ({ type, data, order });
const graph = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m => JSON.parse(m[1]));
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" })[c]!);

test("F1: every platform locale is a loc, reciprocal alternates, bound app details and only valid spec topics", async () => {
  const app = { id: "bound", hostedPageSlug: root.slug, updatedAt: root.updatedAt };
  const entries = buildSitemapEntries([root], [app]);
  const paths = ["/", "/apps", "/websites", "/tools", "/games", ...[...GAMES, TABLETOP_COLLECTION].map(g => `/games/${g.slug}`), "/apps/bound"];
  for (const path of paths) for (const locale of locales) {
    const entry = entries.find(e => e.url === platformUrl(path, locale));
    assert.ok(entry, `${locale} ${path}`);
    assert.deepEqual(entry.alternates?.languages, platformAlternates(path));
    for (const target of Object.values(entry.alternates!.languages!)) assert.ok(entries.some(e => e.url === target));
  }
  assert.equal(new Set(entries.map(e => e.url)).size, entries.length);
  assert.equal(buildSitemapEntries([], []).length, 11 * locales.length + SPEC_TOPICS.length + 1);
  const { GET } = await import("../src/app/spec/[topic]/route.ts");
  for (const topic of SPEC_TOPICS) {
    assert.ok(entries.some(e => e.url === `https://appai.info/spec/${topic}`));
    const response = await GET(new Request(`https://appai.info/spec/${topic}`), { params: Promise.resolve({ topic }) });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type")!, /text\/plain/);
    assert.equal(await response.text(), readFileSync(`docs/spec/${topic}.md`, "utf8"));
  }
  assert.equal((await GET(new Request("https://appai.info/spec/unknown"), { params: Promise.resolve({ topic: "unknown" }) })).status, 404);
  assert.ok(entries.every(e => !/\/play|\/runtime|index\.html|\?|\/en(?:\/|$)|auth|logout/.test(e.url)));
});

test("F1: external marketing never suppresses independently canonical local policy locales", async () => {
  fixtureDb.rows = [root, { ...root, id: "ja", locale: "ja", isDefault: false, canonicalUrl: "https://example.org/ja" },
    { ...root, id: "zh", locale: "zh-TW", isDefault: false, canonicalUrl: "https://example.org/zh", termsOfService: " " }];
  const entries = buildSitemapEntries(fixtureDb.rows as typeof root[], []).filter(e => e.url.includes("/p/"));
  assert.ok(!entries.some(e => e.url.endsWith("/ja") || e.url.endsWith("/zh-TW")));
  for (const entry of entries) {
    const props = { params: Promise.resolve({ segments: new URL(entry.url).pathname.slice(3).split("/") }) };
    const metadata = await hosted.generateMetadata(props);
    assert.equal(metadata.alternates?.canonical, entry.url);
    assert.deepEqual(metadata.alternates?.languages, entry.alternates?.languages);
    assert.equal(metadata.robots, undefined);
    await hosted.default(props); // no 404/redirect for indexed paths
  }
  assert.equal(entries.filter(e => e.url.endsWith("privacy")).length, 3);
  assert.equal(entries.filter(e => e.url.endsWith("terms")).length, 2);
});

test("F2: maintained dates, relevant public updates and no generation-time or invalid dates", async () => {
  assert.equal(latestContentModified([]), PLATFORM_CONTENT_MODIFIED);
  assert.equal(latestContentModified(["not-a-date"]), undefined);
  const website = { ...root, updatedAt: new Date("2026-11-19"), content: { sections: [] } };
  const tool = { ...root, id: "tool", slug: "tool", updatedAt: new Date("2026-11-20"), content: { sections: [section("iframe-tool", {})] } };
  fixtureDb.rows = [website, tool, { ...root, id: "draft", slug: "draft", isPublished: false, updatedAt: new Date("2026-12-01") }];
  fixtureDb.apps = [website, tool].map((p, i) => ({ id: `app${i}`, organizationId: p.organizationId, hostedPageSlug: p.slug, updatedAt: root.updatedAt, isApproved: true, tags: [] }));
  const { loadSitemapShard } = await import("../src/lib/sitemap-data.ts");
  const pageFindMany = fixtureDb.hostedPage.findMany;
  const appFindMany = fixtureDb.app.findMany;
  const queries: { model: string; query: { select: Record<string, boolean> } }[] = [];
  fixtureDb.hostedPage.findMany = async query => { queries.push({ model: "hostedPage", query }); return pageFindMany(query); };
  fixtureDb.app.findMany = async query => { queries.push({ model: "app", query }); return appFindMany(query); };
  let entries;
  try { entries = await loadSitemapShard("0"); }
  finally { fixtureDb.hostedPage.findMany = pageFindMany; fixtureDb.app.findMany = appFindMany; }
  assert.deepEqual(queries.map(({ model }) => model), ["hostedPage", "hostedPage", "app"]);
  assert.ok(queries.every(({ query }) => !query.select.content && !query.select.template));
  assert.deepEqual(Object.keys(queries[2].query.select).sort(), ["hostedPageSlug", "id", "organizationId", "updatedAt"]);
  const dates = Object.fromEntries(entries.map(e => [e.url, e.lastModified]));
  for (const locale of locales) {
    assert.equal(dates[platformUrl("/websites", locale)], tool.updatedAt.toISOString());
    assert.equal(dates[platformUrl("/tools", locale)], tool.updatedAt.toISOString());
    assert.equal(dates[platformUrl("/apps", locale)], tool.updatedAt.toISOString());
    assert.equal(dates[platformUrl("/", locale)], undefined);
    assert.equal(dates[platformUrl("/games", locale)], PLATFORM_CONTENT_MODIFIED);
  }
  assert.equal(dates["https://appai.info/spec"], undefined);
  assert.ok(!entries.some(e => e.url.includes("draft")));
  assert.deepEqual(await loadSitemapShard("0"), entries);
});

test("F3: English and Chinese waiting/small-group copy and exact visible FAQ/schema agreement", async () => {
  for (const locale of locales) {
    fixtureDb.locale = locale;
    const hub = getGamesCopy(locale);
    if (["en", "zh-TW", "zh-CN"].includes(locale)) assert.match(hub.metaDescription, locale === "en" ? /restaurant.*queue.*doctor’s office.*small group/ : /餐[廳厅].*排[隊队].*候診|餐厅.*排队.*候诊/);
    for (const slug of [undefined, ...GAMES.map(g => g.slug), TABLETOP_COLLECTION.slug]) {
      const html = await renderHtml(slug ? await gameDetail.default({ params: Promise.resolve({ locale, slug }) }) : await gameHub.default());
      const faq = slug ? getGamePageCopy(locale, slug).faq : getGamesHubFaq(locale);
      const schema = graph(html).find(g => g["@type"] === "FAQPage");
      assert.deepEqual(schema.mainEntity, faq.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })));
      const visible = html.replace(/<script\b[\s\S]*?<\/script>/g, "");
      for (const { question, answer } of faq) { assert.ok(visible.includes(escapeHtml(question))); assert.ok(visible.includes(escapeHtml(answer))); }
      if (slug === "werewolf" && ["en", "zh-TW", "zh-CN"].includes(locale)) assert.match(getGamePageCopy(locale, slug).intro, /quiet waiting room|不適合安靜的候診室|不适合安静的候诊室/);
      const puzzle = GAMES.find(game => game.slug === slug)?.puzzle;
      if (puzzle) assert.ok(faq.every(({ question, answer }) => !`${question} ${answer}`.includes("10–15")));
      else if ((!slug || slug === TABLETOP_COLLECTION.slug) && ["en", "zh-TW", "zh-CN"].includes(locale)) {
        assert.ok(faq.some(({ answer }) => answer.includes("10–15")));
      }
    }
  }
});

test("F4: description uses only public visible summaries in display order, preserving authored bytes", () => {
  assert.equal(resolveHostedDescription(root), root.metaDescription);
  assert.equal(resolveHostedDescription({ ...root, metaDescription: "" }), root.tagline);
  assert.equal(resolveHostedDescription({ ...root, metaDescription: "   " }), root.tagline);
  assert.equal(resolveHostedDescription({ ...root, metaDescription: "  ", tagline: "\n" }), "Public summary");
  const literalHero = "Use *stars*, [brackets](text), <labels> &amp; underscores_here.";
  assert.equal(resolveHostedDescription({ content: { sections: [section("hero", { subheadline: literalHero })] } }), literalHero);
  const content = { sections: [section("hero", { subheadline: "SECRET", access: "login" }, -3),
    section("profile-header", { intro: "ADMIN SECRET", access: "admin" }, -2),
    section("project-cards", { intro: "NOT RENDERED", items: [{ name: "News", description: "CARD SECRET" }] }, -1),
    section("entries", { intro: "  **Public** [summary](https://example.org) &amp; `code`.\n\nMore text. ![IMAGE ALT](image.png)" }, 2),
    section("hero", { subheadline: "Later" }, 3)] };
  const page = { content };
  assert.equal(resolveHostedDescription(page), "Public summary & code. More text.");
  assert.equal(buildJsonLd(page, "https://example.org", "https://example.org", null)["@graph"][0].description, resolveHostedDescription(page));
  for (const sections of [[], content.sections.slice(0, 3), [section("about", { text: "Not a summary" })]]) assert.equal(resolveHostedDescription({ content: { sections } }), undefined);
  const long = resolveHostedDescription({ content: { sections: [section("entries", { intro: "🧩".repeat(190) })] } })!;
  assert.equal(Array.from(long).length, 180);
  const sentence = "A public summary with enough detail to explain the page for readers before the next sentence begins.";
  assert.equal(resolveHostedDescription({ content: { sections: [section("entries", { intro: `${sentence} ${"More words ".repeat(30)}` })] } }), sentence);
});

test("F4: root/child metadata shares fallback with JSON-LD and missing description warns without blocking", async () => {
  for (const child of [false, true]) {
    const page = { ...root, id: child ? "child" : "root", slug: child ? "seo-child" : root.slug, parentSlug: child ? root.slug : null,
      metaDescription: null, tagline: null, content: { sections: [section("entries", { intro: "每支影片的重點、從哪裡開始看，以及影片裡的圖解。" })] } };
    fixtureDb.rows = child ? [root, page] : [page];
    fixtureDb.apps = [];
    const props = { params: Promise.resolve({ segments: [root.slug, ...(child ? [page.slug] : [])] }) };
    const meta = await hosted.generateMetadata(props);
    const html = await renderHtml(await hosted.default(props));
    assert.equal(meta.description, page.content.sections[0].data.intro);
    assert.equal(meta.openGraph?.description, meta.description);
    assert.equal(meta.twitter?.description, meta.description);
    assert.equal(graph(html)[0]["@graph"][0].description, meta.description);
    assert.ok(html.includes(meta.description!));
  }
  for (const content of [{ sections: [] }, { sections: [section("hero", { subheadline: "Secret", access: "login" })] }]) {
    const result = checkPagePreview({ slug: "preview-seo", title: "Preview", content });
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some(w => w.path === "metaDescription"));
  }
  const result = checkPagePreview({ slug: "preview-seo", title: "Preview", content: root.content });
  assert.equal(result.valid, true);
  assert.ok(!result.warnings.some(w => w.path === "metaDescription"));
});

test("F5: six directory locales have complete authored UI, actual directory/home rendering and no English fallback", async () => {
  const { PlatformDirectory } = await import("../src/components/PlatformDirectory.tsx");
  const { default: Home } = await import("../src/app/[locale]/page.tsx");
  const strings = (value: unknown): string[] => typeof value === "string" ? [value] : Object.values(value as object).flatMap(strings);
  for (const locale of ["ja", "ko", "de", "fr", "es", "hi"]) {
    const copy = getDirectoryCopy(locale);
    assert.equal(strings(copy).length, strings(getDirectoryCopy("en")).length);
    assert.ok(strings(copy).every(value => value.trim()));
    assert.notEqual(copy.description, getDirectoryCopy("en").description);
    fixtureDb.locale = locale; fixtureDb.rows = []; fixtureDb.apps = [];
    for (const kind of [undefined, "websites", "tools"] as const) {
      const html = await renderHtml(await PlatformDirectory({ kind }));
      assert.ok(html.includes(escapeHtml(kind ? copy.entrances[kind].title : copy.title)));
      assert.ok(html.includes(escapeHtml(copy.emptyTitle)));
      assert.ok(!html.includes("Nothing here yet"));
    }
    const home = await renderHtml(await Home());
    assert.ok(home.includes(escapeHtml(copy.entranceTitle)));
    assert.ok(!home.includes("Find what you need"));
  }
});

test("F6/F7: precise raw HTML noindex headers, crawlable auth noindex shells and unchanged play rewrites", async () => {
  const config = (await import("../next.config.ts")).default;
  const oldConfig = (await import(baseline.moduleUrl("next.config.ts"))).default;
  const rules = await config.headers!();
  const raw = rules.filter(rule => rule.headers.some(h => h.key === "X-Robots-Tag"));
  assert.deepEqual(raw.map(rule => rule.source), ["river-crossing", "guess-duel", "werewolf"].map(slug => `/games/${slug}/index.html`));
  assert.ok(raw.every(rule => rule.headers[0].value === "noindex, follow"));
  assert.deepEqual(await config.rewrites!(), await oldConfig.rewrites());
  assert.deepEqual(rules.filter(rule => !raw.includes(rule)), await oldConfig.headers());
  const { metadata: logout } = await import("../src/app/[locale]/logout/page.tsx");
  const { metadata: device } = await import("../src/app/[locale]/auth/device/layout.tsx");
  assert.deepEqual(logout.robots, { index: false, follow: true });
  assert.deepEqual(device.robots, logout.robots);
  const robots = (await import("../src/app/robots.ts")).default();
  for (const rule of Array.isArray(robots.rules) ? robots.rules : [robots.rules]) {
    assert.ok(Array.isArray(rule.disallow) && rule.disallow.includes("/api/"));
    for (const locale of locales) for (const path of ["/auth/device", "/logout"]) {
      const url = new URL(platformUrl(path, locale)).pathname;
      assert.ok(!rule.disallow!.some(block => url.startsWith(block)));
    }
  }
});

test("F8: six PNG social assets are 1200×630, reproducible from SVG, all 9 locales use raster", async () => {
  for (const game of [...GAMES, TABLETOP_COLLECTION]) {
    const path = `public${game.cover.replace(/\.svg$/, ".png")}`;
    const actual = readFileSync(path);
    const info = await sharp(actual).metadata();
    assert.equal(info.format, "png"); assert.equal(info.width, 1200); assert.equal(info.height, 630);
    const expected = await sharp(readFileSync(`public${game.cover}`), { density: 144 }).resize(1200, 630, { fit: "contain", background: "#0f172a" }).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
    assert.deepEqual(actual, expected);
    assert.deepEqual(readFileSync(`public${game.cover}`), execFileSync("git", ["show", `3ddf782:public${game.cover}`]));
    for (const locale of locales) {
      const meta = buildGamePageMetadata(game, locale);
      assert.deepEqual(meta.twitter?.images, [`https://appai.info${game.cover.replace(/\.svg$/, ".png")}`]);
      assert.deepEqual(meta.openGraph?.images, [{ url: `https://appai.info${game.cover.replace(/\.svg$/, ".png")}`, width: 1200, height: 630, alt: getGamesCopy(locale).games[game.slug].name }]);
    }
  }
});

test("F9: third-party app and download schemas omit unknown price, all other app metadata/schema stays identical; HTML allows F5 navigation translations", async () => {
  fixtureDb.rows = [root];
  fixtureDb.apps = [{ id: "app", name: "Fictional app", organizationId: root.organizationId, hostedPageSlug: root.slug, isApproved: true, category: "OTHER", tags: [], screenshots: [] }];
  for (const locale of locales) {
    fixtureDb.locale = locale;
    const props = { params: Promise.resolve({ id: "app", locale }) };
    assert.equal(JSON.stringify(await appDetail.generateMetadata(props)), JSON.stringify(await oldAppDetail.generateMetadata(props)));
    const html = await renderHtml(await appDetail.default(props));
    const oldHtml = await renderHtml(await oldAppDetail.default(props));
    const oldWithTranslatedHeader = oldHtml.replace(/<header\b[\s\S]*?<\/header>/, (header: string) => {
      const copy = getDirectoryCopy(locale);
      return header.replace(/>Websites</g, `>${escapeHtml(copy.categories.websites)}<`)
        .replace(/>Tools</g, `>${escapeHtml(copy.categories.tools)}<`).replace(/>Apps</g, `>${escapeHtml(copy.categories.apps)}<`);
    });
    assert.equal(html, oldWithTranslatedHeader.replace(',"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}', ""));
    assert.equal(graph(html)[0].offers, undefined);
  }
  const page = { ...root, content: { sections: [section("download", { appStoreUrl: "https://apps.apple.com/app/id123456789" })] } };
  const before = oldSeo.buildJsonLd(page, "https://example.org", "https://example.org", null);
  const after = buildJsonLd(page, "https://example.org", "https://example.org", null);
  delete before["@graph"][0].offers;
  assert.equal(JSON.stringify(after), JSON.stringify(before));
});

test("untargeted hosted root/child/legal SEO and full body remain byte-identical to 3ddf782", async () => {
  for (const template of ["APP_LANDING", "PERSON", "PORTFOLIO", "LINK_IN_BIO"]) {
    fixtureDb.rows = locales.flatMap((locale, i) => [{ ...root, template, locale, isDefault: i === 0 },
      { ...root, template, id: `child-${locale}`, slug: "seo-child", parentSlug: root.slug, locale, isDefault: i === 0 }]);
    fixtureDb.apps = [];
    for (const locale of locales) for (const suffix of ["", "seo-child", "privacy", "terms"]) {
      const props = { params: Promise.resolve({ segments: [root.slug, ...(locale === "en" ? [] : [locale]), ...(suffix ? [suffix] : [])] }) };
      assert.equal(JSON.stringify(await hosted.generateMetadata(props)), JSON.stringify(await oldHosted.generateMetadata(props)));
      // #91 visitor-language chrome adds inert data-chrome-* markers only.
      const stripChrome = (html: string) => html.replace(/ data-chrome-[a-z-]+="[^"]*"/g, "");
      assert.equal(stripChrome(await renderHtml(await hosted.default(props))), await renderHtml(await oldHosted.default(props)));
    }
  }
});

test("untargeted six-locale game HTML/JSON-LD stays byte-identical; metadata changes only social images", async () => {
  for (const locale of ["ja", "ko", "de", "fr", "es", "hi"]) {
    fixtureDb.locale = locale;
    assert.equal(await renderHtml(await gameHub.default()), await renderHtml(await oldGameHub.default()));
    for (const game of [...GAMES, TABLETOP_COLLECTION]) {
      const props = { params: Promise.resolve({ locale, slug: game.slug }) };
      assert.equal(await renderHtml(await gameDetail.default(props)), await renderHtml(await oldGameDetail.default(props)));
      const before = oldGameSeo.buildGamePageMetadata(game, locale);
      const after = buildGamePageMetadata(game, locale);
      before.openGraph.images = after.openGraph!.images;
      before.twitter.images = after.twitter!.images;
      assert.equal(JSON.stringify(after), JSON.stringify(before));
    }
  }
});
