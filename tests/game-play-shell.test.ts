import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { GAMES, getOwnGame, gamePlayHref } from "../src/lib/games-catalog.ts";
import { gameNavigationLocale, injectGameNavigation } from "../src/lib/game-play-shell.ts";
import { getGamePageLabels } from "../src/lib/games-pages-copy.ts";
import { locales } from "../src/i18n/routing.ts";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";

test("play shell localizes three navigation links, reserves control space and keeps static assets", () => {
  for (const game of GAMES) for (const locale of locales) {
    const source = readFileSync(new URL(`../public/games/${game.buildSlug}/index.html`, import.meta.url), "utf8");
    const html = injectGameNavigation(source, game, locale);
    const labels = getGamePageLabels(locale);
    const nav = html.match(/<nav id="appai-play-nav"[\s\S]*?<\/nav>/)![0];
    assert.equal([...nav.matchAll(/<a\b/g)].length, 3);
    for (const label of [labels.gameInfo, labels.allGames, labels.appaiHome]) assert.ok(nav.includes(label));
    const prefix = locale === "en" ? "" : `/${locale}`;
    assert.ok(nav.includes(`href="${prefix}/games/${game.slug}"`));
    assert.equal(gameNavigationLocale(new URL(gamePlayHref(game, locale), "https://appai.info")), locale);
    assert.match(html, /min-height:44px/);
    assert.match(html, /position:fixed/);
    assert.match(html, /padding-top:var\(--appai-play-bar-height\)/);
    assert.match(html, /@media\(max-width:400px\)/);
    assert.doesNotMatch(html, /<iframe/);
    for (const asset of source.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) assert.ok(html.includes(asset[0]));
    assert.equal(html.includes(".about-link{display:none!important}"), !!game.puzzle);
    if (game.puzzle) {
      assert.match(html, /#app\{top:var\(--appai-play-bar-height\)/);
      assert.match(html, /\.menu\{bottom:.*;max-height:none/);
    }
  }
});

test("navigation language respects explicit query, legacy Werewolf language, cookie, and English fallback", () => {
  for (const [search, cookie, expected] of [
    ["?locale=zh-CN", "zh-TW", "zh-CN"], ["?locale=zh-TW", "en", "zh-TW"],
    ["?lang=zh", "en", "zh-TW"], ["?locale=ko&lang=zh", "zh-TW", "ko"],
    ["?locale=zh", "zh-TW", "en"],
    ["", "zh-CN", "zh-CN"], ["", undefined, "en"], ["?locale=__proto__", undefined, "en"],
  ]) assert.equal(gameNavigationLocale(new URL(`https://appai.info/games/werewolf/play${search}`), cookie), expected);
});

function boot(slug: string, search: string, hash = "") {
  const game = getOwnGame(slug)!;
  const html = injectGameNavigation("<html lang=\"en\"><head></head><body></body></html>", game, "en");
  const script = html.match(/<script id="appai-play-bootstrap">([\s\S]*?)<\/script>/)![1];
  const location = new URL(`https://appai.info/games/${slug}/play${search}${hash}`);
  const link = { href: "" };
  const listeners: Record<string, () => void> = {};
  const history = {
    state: { preserved: true } as object,
    replaceState(state: object, _unused: string, url: string) { this.state = state; location.href = new URL(url, location).href; },
    pushState(state: object, _unused: string, url: string) { this.state = state; location.href = new URL(url, location).href; },
  };
  runInNewContext(script, { location, history, URLSearchParams, document: { getElementById: () => link }, addEventListener: (event: string, listener: () => void) => { listeners[event] = listener; } });
  return { location, history, link, listeners };
}

test("bare play selects the page's puzzle using the existing game parameter", () => {
  for (const game of GAMES.filter((game) => game.puzzle)) {
    const { location, history, link } = boot(game.slug, "?tag=a%2fb&tag=two&empty=&bare", "#state");
    assert.equal(location.search, `?tag=a%2fb&tag=two&empty=&bare&game=${game.puzzle}`);
    assert.equal(location.hash, "#state");
    assert.equal(link.href, `/games/${game.slug}`);
    assert.deepEqual(history.state, { preserved: true });
    const direct = new URL(gamePlayHref(game, "en"), "https://appai.info");
    assert.equal(boot(game.slug, direct.search).location.search, direct.search);
  }
});

test("old game, level, challenge and claim payloads retain raw query and hash at bootstrap", () => {
  for (const game of GAMES.filter((game) => game.puzzle)) for (const search of [
    "?game=bridge&level=hard&tag=a%2fb&game=water", "?challenge=hard&c=13&t=83&n=River%20Friend",
    "?claim=run%2D1&locale=zh-TW", "?level=hard&empty=&bare", "?game=toString", "?game=__proto__",
  ]) {
    const { location } = boot(game.slug, search, "#r=abc_DEF-123");
    assert.equal(location.search, search);
    assert.equal(location.hash, "#r=abc_DEF-123");
  }
});

test("Game info follows internal puzzle switching and history navigation without changing state", () => {
  const { history, link, location, listeners } = boot("river-crossing", "?game=bridge");
  assert.equal(link.href, "/games/night-bridge");
  history.replaceState({ preserved: true }, "", "?game=water&level=easy#water-state");
  assert.equal(link.href, "/games/water-pouring");
  assert.equal(location.hash, "#water-state");
  history.pushState({ preserved: true }, "", "?locale=en");
  assert.equal(link.href, "/games/tabletop-puzzles");
  location.search = "?game=river";
  listeners.popstate();
  assert.equal(link.href, "/games/river-crossing");
});

test("runtime route serves all five pages from allowlisted existing static builds, including HEAD", async () => {
  const hooks = registerHostedRenderLoader();
  try {
    const { GET } = await import("../src/app/games/[slug]/runtime/route.ts");
    const { NextRequest } = await import("next/server");
    for (const game of GAMES) for (const method of ["GET", "HEAD"]) {
      const response = await GET(new NextRequest(`https://appai.info${gamePlayHref(game, "zh-CN")}`, { method }), { params: Promise.resolve({ slug: game.slug }) });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
      assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
      const html = await response.text();
      assert.ok(html.includes(getGamePageLabels("zh-CN").gameInfo));
      assert.match(html, new RegExp(`/games/${game.buildSlug}/`));
    }
    for (const slug of ["tabletop-puzzles", "unknown", "__proto__", "..", "covers"]) {
      const response = await GET(new NextRequest("https://appai.info/games/unknown/runtime"), { params: Promise.resolve({ slug }) });
      assert.equal(response.status, 404);
    }
  } finally { hooks.deregister(); }
});
