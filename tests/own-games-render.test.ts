import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAMES, GAME_PAGE_SLUGS, TABLETOP_COLLECTION, gamePageHref, gamePlayHref, getGamesCopy } from "../src/lib/games-catalog.ts";
import { getGamePageCopy, getGamePageLabels } from "../src/lib/games-pages-copy.ts";
import { platformUrl } from "../src/lib/platform-seo.ts";
import { gameBreadcrumbs, buildGameBreadcrumbJsonLd } from "../src/lib/games-page-seo.ts";
import { locales } from "../src/i18n/routing.ts";
import { renderHtml } from "./helpers/render-html.mjs";
import { registerHostedRenderLoader, registerDirectoryFixtures, fixtureDb } from "./helpers/hosted-render-loader.mjs";

const hooks = registerHostedRenderLoader();
const intl = registerDirectoryFixtures({ translated: true });
test.after(() => { intl.deregister(); hooks.deregister(); });
const detail = await import("../src/app/[locale]/games/[slug]/page.tsx");
const hub = await import("../src/app/[locale]/games/page.tsx");

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" })[char]!);
}

test("detail routes enumerate own games and reject unknown slugs in the page and metadata", async () => {
  assert.deepEqual(detail.generateStaticParams(), GAME_PAGE_SLUGS.map((slug) => ({ slug })));
  for (const slug of ["unknown", "covers", "toString"]) {
    const params = Promise.resolve({ locale: "en", slug });
    await assert.rejects(() => detail.default({ params, searchParams: Promise.resolve({}) }), /NEXT_HTTP_ERROR_FALLBACK;404/);
    await assert.rejects(() => detail.generateMetadata({ params }), /NEXT_HTTP_ERROR_FALLBACK;404/);
  }
});

test("all localized detail pages render one H1, cover, instructions, parent FAQ and sibling page links", async () => {
  for (const locale of locales) for (const game of GAMES) {
    fixtureDb.locale = locale;
    const params = Promise.resolve({ locale, slug: game.slug });
    const html = await renderHtml(await detail.default({ params, searchParams: Promise.resolve({}) }));
    const summary = getGamesCopy(locale).games[game.slug];
    const copy = getGamePageCopy(locale, game.slug);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    assert.match(html, new RegExp(`<h1[^>]*>${escapeHtml(summary.name)}</h1>`));
    assert.ok(html.includes(escapeHtml(copy.intro)));
    assert.ok(html.includes(escapeHtml(copy.background)));
    assert.ok(html.includes(`src="${game.cover}"`));
    assert.ok(html.includes(`href="${escapeHtml(gamePlayHref(game, locale))}"`));
    assert.ok(html.includes(`<noscript><a href="${escapeHtml(gamePlayHref(game, locale))}">${escapeHtml(getGamesCopy(locale).play)}</a></noscript>`));
    for (const step of summary.howToPlay) assert.ok(html.includes(escapeHtml(step)));
    assert.ok(html.includes(escapeHtml(summary.players)));
    assert.ok(html.includes(escapeHtml(summary.ages)));
    for (const item of copy.faq) {
      assert.ok(html.includes(escapeHtml(item.question)));
      assert.ok(html.includes(escapeHtml(item.answer)));
    }
    for (const other of GAMES.filter((entry) => entry.slug !== game.slug)) {
      assert.ok(html.includes(`href="${new URL(platformUrl(gamePageHref(other), locale)).pathname}"`));
    }
    assert.ok(html.includes(`href="${locale === "en" ? "" : `/${locale}`}/games"`));
    if (game.status === "beta") assert.ok(html.includes(escapeHtml(getGamePageLabels(locale).betaNotice)));
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1);
    const [video, faq] = JSON.parse(scripts[0][1]);
    assert.equal(video["@type"], "VideoGame");
    assert.equal(faq["@type"], "FAQPage");
    assert.equal(faq.mainEntity.length, copy.faq.length);
    const metadata = await detail.generateMetadata({ params });
    assert.equal(metadata.alternates?.canonical, platformUrl(gamePageHref(game), locale));
  }
});

test("legacy shared links keep their language preference in the new page's Play link", async () => {
  fixtureDb.locale = "en";
  for (const game of GAMES) {
    const params = Promise.resolve({ locale: "en", slug: game.slug });
    const html = await renderHtml(await detail.default({ params, searchParams: Promise.resolve({ locale: "zh-TW" }) }));
    assert.ok(html.includes(`href="${escapeHtml(gamePlayHref(game, "zh-TW"))}"`));
    const metadata = await detail.generateMetadata({ params });
    assert.equal(metadata.alternates?.canonical, platformUrl(gamePageHref(game), "en"));
    if (game.slug === "werewolf") {
      const legacy = await renderHtml(await detail.default({ params, searchParams: Promise.resolve({ lang: "zh" }) }));
      assert.ok(legacy.includes('href="/games/werewolf/play?lang=zh"'));
    }
  }
});

test("every game, collection and hub has linked breadcrumbs, home branding and the four footer links", async () => {
  for (const locale of locales) {
    fixtureDb.locale = locale;
    for (const slug of [undefined, ...GAME_PAGE_SLUGS]) {
      const html = await renderHtml(slug ? await detail.default({ params: Promise.resolve({ locale, slug }), searchParams: Promise.resolve({}) }) : await hub.default());
      const breadcrumb = html.match(new RegExp(`<nav aria-label="${escapeHtml(getGamePageLabels(locale).breadcrumb)}"[\\s\\S]*?<\\/nav>`))?.[0];
      assert.ok(breadcrumb);
      const items = gameBreadcrumbs(locale, slug);
      for (const { name, href } of items) {
        const expected = href === "/" ? `${locale === "en" ? "" : `/${locale}`}/` : new URL(platformUrl(href, locale)).pathname;
        assert.ok(breadcrumb.includes(`href="${expected}"`));
        assert.ok(breadcrumb.includes(escapeHtml(name)));
      }
      assert.equal([...breadcrumb.matchAll(/aria-current="page"/g)].length, 1);
      const current = items.at(-1)!;
      assert.ok([...breadcrumb.matchAll(/<a\b[^>]*>/g)].some(([tag]) => tag.includes(`href="${new URL(platformUrl(current.href, locale)).pathname}"`) && tag.includes('aria-current="page"')));
      const header = html.match(/<header\b[\s\S]*?<\/header>/)![0];
      assert.match(header, /src="\/appai-logo2.png"/);
      const home = `${locale === "en" ? "" : `/${locale}`}/`;
      assert.ok(header.includes(`href="${home}"`));
      const footer = html.match(/<footer\b[\s\S]*?<\/footer>/)![0];
      for (const href of [home, new URL(platformUrl("/games", locale)).pathname, "/spec", "#game-faq"]) assert.ok(footer.includes(`href="${href}"`));
      const labels = getGamePageLabels(locale);
      for (const label of [labels.home, labels.allGames, labels.docs, labels.faqLink]) assert.ok(footer.includes(escapeHtml(label)));
      assert.match(html, /id="game-faq"/);
      const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
      assert.deepEqual(data.find((item: { "@type": string }) => item["@type"] === "BreadcrumbList"), buildGameBreadcrumbJsonLd(locale, slug));
    }
  }
});

test("collection renders its own H1 and all three puzzle pages with no collection Play URL", async () => {
  for (const locale of locales) {
    fixtureDb.locale = locale;
    const slug = TABLETOP_COLLECTION.slug;
    const html = await renderHtml(await detail.default({ params: Promise.resolve({ locale, slug }), searchParams: Promise.resolve({}) }));
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    assert.match(html, new RegExp(`<h1[^>]*>${escapeHtml(getGamesCopy(locale).games[slug].name)}</h1>`));
    for (const game of GAMES.filter((game) => game.puzzle)) assert.ok(html.includes(`href="${new URL(platformUrl(gamePageHref(game), locale)).pathname}"`));
    assert.ok(!html.includes("/tabletop-puzzles/play"));
    for (const { question, answer } of getGamePageCopy(locale, slug).faq) {
      assert.ok(html.includes(escapeHtml(question)));
      assert.ok(html.includes(escapeHtml(answer)));
    }
    const response = await detail.generateMetadata({ params: Promise.resolve({ locale, slug }) });
    assert.equal(response.alternates?.canonical, platformUrl(`/games/${slug}`, locale));
  }
});

test("hub titles and buttons link to locale-aware detail pages and share canonical metadata", async () => {
  for (const locale of locales) {
    fixtureDb.locale = locale;
    const html = await renderHtml(await hub.default());
    for (const game of GAMES) {
      const path = new URL(platformUrl(gamePageHref(game), locale)).pathname;
      assert.equal([...html.matchAll(/href="([^"]+)"/g)].filter((match) => match[1] === path).length, 2);
      assert.ok(!html.includes(`${gamePageHref(game)}/play`));
    }
    const metadata = await hub.generateMetadata();
    assert.equal(metadata.alternates?.canonical, platformUrl("/games", locale));
    assert.equal(Object.keys(metadata.alternates!.languages!).length, 10);
  }
});

test("homepage strip follows main sections, uses nine message files and only lists live/Beta own games", async () => {
  const { default: HomePage } = await import("../src/app/[locale]/page.tsx");
  fixtureDb.rows = [];
  fixtureDb.apps = [];
  const english = JSON.parse(readFileSync(new URL("../src/messages/en.json", import.meta.url), "utf8")).home;
  for (const locale of locales) {
    fixtureDb.locale = locale;
    const messages = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), "utf8")).home;
    const html = await renderHtml(await HomePage());
    const start = html.indexOf('<section aria-labelledby="home-games"');
    const strip = html.slice(start, html.indexOf("</section>", start));
    assert.ok(start > html.indexOf(escapeHtml(messages.forAgents)));
    assert.ok(start > html.indexOf(escapeHtml(messages.readyToLaunch)));
    assert.ok(strip.includes(escapeHtml(messages.gamesTitle)));
    assert.ok(strip.includes(escapeHtml(messages.gamesDescription)));
    assert.ok(strip.includes(escapeHtml(messages.gamesViewAll)));
    for (const game of GAMES) {
      assert.ok(strip.includes(`href="${new URL(platformUrl(gamePageHref(game), locale)).pathname}"`));
      assert.ok(strip.includes(`src="${game.cover}"`));
      assert.ok(strip.includes(escapeHtml(getGamesCopy(locale).games[game.slug].tagline)));
    }
    if (locale === "zh-TW") assert.match(messages.gamesDescription, /託管/);
    if (locale !== "en") {
      for (const key of ["gamesTitle", "gamesDescription", "gamesViewAll"]) {
        assert.ok(messages[key].trim());
        assert.notEqual(messages[key], english[key]);
      }
    }
  }
  const original = GAMES[0].status;
  try {
    GAMES[0].status = "soon";
    const html = await renderHtml(await HomePage());
    const start = html.indexOf('<section aria-labelledby="home-games"');
    const strip = html.slice(start, html.indexOf("</section>", start));
    assert.ok(!strip.includes(gamePageHref(GAMES[0])));
    assert.ok(strip.includes(gamePageHref(GAMES[1])));
  } finally { GAMES[0].status = original; }
});

test("middleware passes play/assets through but sends exact own-game pages through next-intl", async () => {
  const { middleware } = await import("../src/middleware.ts");
  const { NextRequest } = await import("next/server");
  for (const game of GAMES) {
    for (const path of [gamePageHref(game), `${gamePageHref(game)}?locale=zh-TW`]) {
      const response = middleware(new NextRequest(`https://appai.info${path}`, { headers: { "accept-language": "en" } }));
      assert.equal(new URL(response.headers.get("x-middleware-rewrite")!).pathname, `/en/games/${game.slug}`);
    }
    for (const tail of ["play", "assets/file.js", "src/app.js"]) {
      const response = middleware(new NextRequest(`https://appai.info${gamePageHref(game)}/${tail}`));
      assert.equal(response.headers.get("x-middleware-next"), "1");
      assert.equal(response.headers.get("x-middleware-rewrite"), null);
    }
  }
  const cover = middleware(new NextRequest("https://appai.info/games/covers/werewolf.svg"));
  assert.equal(cover.headers.get("x-middleware-next"), "1");
  const collection = middleware(new NextRequest("https://appai.info/games/tabletop-puzzles", { headers: { "accept-language": "en" } }));
  assert.equal(new URL(collection.headers.get("x-middleware-rewrite")!).pathname, "/en/games/tabletop-puzzles");
});

test("Next rewrites only own /play URLs to the HTML navigation handler", async () => {
  const { default: config } = await import("../next.config.ts");
  assert.ok(config.rewrites);
  const rewrites = await config.rewrites();
  assert.ok(!Array.isArray(rewrites));
  assert.ok(rewrites.beforeFiles);
  const ownRule = rewrites.beforeFiles.find((rule) => rule.destination === "/games/:slug/runtime");
  assert.ok(ownRule);
  assert.equal(ownRule.source, `/games/:slug(${GAMES.map((game) => game.slug).join("|")})/play`);
  assert.equal(rewrites.beforeFiles.length, 1);
  assert.ok(!ownRule.source.includes("tabletop-puzzles"));
  assert.deepEqual(config.outputFileTracingIncludes?.["/games/*/runtime"], ["./public/games/**/index.html"]);
});
