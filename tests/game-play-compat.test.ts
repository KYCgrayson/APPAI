import test from "node:test";
import assert from "node:assert/strict";
import { GAMES } from "../src/lib/games-catalog.ts";
import { locales } from "../src/i18n/routing.ts";
import { needsGamePlayRedirect, gamePlayServerRedirect } from "../src/lib/game-play-compat.ts";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";

test("old room, puzzle, challenge and claim queries need play, including empty values", () => {
  for (const [slug, keys] of [
    ["guess-duel", ["room", "theme", "color", "api", "debug"]],
    ["river-crossing", ["game", "level", "challenge", "c", "t", "n", "claim", "theme", "color", "debug"]],
    ["night-bridge", ["game", "level", "challenge", "c", "t", "n", "claim", "theme", "color", "debug"]],
    ["water-pouring", ["game", "level", "challenge", "c", "t", "n", "claim", "theme", "color", "debug"]],
  ] as const) {
    for (const key of keys) for (const value of ["", "test", "zh-TW"]) {
      assert.ok(needsGamePlayRedirect(slug, `?${key}=${value}&locale=zh-TW`, ""), `${slug}/${key}`);
    }
  }
  assert.ok(needsGamePlayRedirect("guess-duel", "?room=AB12CD", ""));
  assert.ok(needsGamePlayRedirect("guess-duel", "?%72oom=AB12CD", ""));
  assert.ok(needsGamePlayRedirect("river-crossing", "?game=bridge&challenge=hard&c=13&t=83&n=River", ""));
});

test("every own game forwards non-empty hashes, including empty and populated relay payloads", () => {
  for (const { slug } of GAMES) for (const hash of ["#r=", "#r=abc_DEF-123", "#anything"]) {
    assert.ok(needsGamePlayRedirect(slug, "", hash));
    assert.ok(needsGamePlayRedirect(slug, "?locale=zh-TW&lang=zh", hash));
  }
});

test("plain, language-only and unrelated queries stay on the description page", () => {
  for (const { slug } of GAMES) for (const search of ["", "?", "?locale=zh-TW", "?lang=zh", "?locale=en&locale=zh-TW", "?locale=zh-TW&lang=zh&utm_source=friend", "?returnTo=%2Fgames"]) {
    assert.equal(needsGamePlayRedirect(slug, search, ""), false, `${slug}${search}`);
  }
  assert.equal(needsGamePlayRedirect("werewolf", "?room=AB12CD", ""), false);
  assert.equal(needsGamePlayRedirect("guess-duel", "?claim=run-1&game=river", ""), false);
  for (const slug of ["unknown", "toString", "__proto__"]) {
    assert.equal(needsGamePlayRedirect(slug, "?room=AB12CD", "#r=payload"), false);
  }
});

test("middleware decision carries the platform locale and keeps raw query order, duplicates and encoding", () => {
  for (const prefix of ["", ...locales.map((locale) => `/${locale}`)]) for (const slash of ["", "/"]) {
    const search = "?room=AB%20CD&locale=zh-TW&tag=a%2fb&room=EF%2bGH&empty=&bare";
    assert.equal(gamePlayServerRedirect(`${prefix}/games/guess-duel${slash}`, search), `/games/guess-duel/play${search}`);
    const language = prefix ? `&locale=${prefix.slice(1)}` : "";
    assert.equal(gamePlayServerRedirect(`${prefix}/games/river-crossing${slash}`, "?claim=run%2D1"), `/games/river-crossing/play?claim=run%2D1${language}`);
    for (const slug of ["night-bridge", "water-pouring"]) assert.equal(gamePlayServerRedirect(`${prefix}/games/${slug}${slash}`, "?game=water&level=hard&claim=run%2D1"), `/games/${slug}/play?game=water&level=hard&claim=run%2D1${language}`);
    assert.equal(gamePlayServerRedirect(`${prefix}/games/guess-duel${slash}`, "?room=AB%20CD&empty=&bare"), `/games/guess-duel/play?room=AB%20CD&empty=&bare${language}`);
  }
});

test("middleware decision keeps explicit game language ahead of a route locale", () => {
  assert.equal(gamePlayServerRedirect("/zh-TW/games/river-crossing", "?challenge=hard"), "/games/river-crossing/play?challenge=hard&locale=zh-TW");
  assert.equal(gamePlayServerRedirect("/zh-TW/games/guess-duel", "?room=AB12CD&locale=ja"), "/games/guess-duel/play?room=AB12CD&locale=ja");
});

test("server redirect leaves detail language, play, assets, hosted /p/ and unknown routes alone", () => {
  for (const { slug } of GAMES) for (const search of ["", "?locale=zh-TW", "?lang=zh", "?locale=ja", "?utm_source=friend"]) {
    for (const prefix of ["", ...locales.map(locale => `/${locale}`)]) assert.equal(gamePlayServerRedirect(`${prefix}/games/${slug}`, search), null);
  }
  for (const pathname of ["/games", "/games/tabletop-puzzles", "/games/tabletop-puzzles/play", "/games/boards", "/games/profile", "/games/unknown", "/games/toString", "/games/guess-duel/play", "/games/guess-duel/play/", "/games/guess-duel/index.html", "/games/guess-duel/assets/index.js", "/p/guess-duel", "/p/river-crossing", "/xx/games/guess-duel", "/zh-TW/games/guess-duel/play"]) {
    assert.equal(gamePlayServerRedirect(pathname, "?room=AB12CD&claim=run-1"), null, pathname);
  }
});

test("middleware sends a 307 to locale-free play before language detection with the original query", async () => {
  const hooks = registerHostedRenderLoader();
  try {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../src/middleware.ts");
    for (const method of ["GET", "HEAD"]) for (const prefix of ["", "/zh-TW"]) {
      for (const [slug, search] of [["guess-duel", "?room=AB%20CD&locale=zh-TW&room=EF%2bGH"], ["river-crossing", "?claim=run%2D1&locale=zh-TW"], ["river-crossing", "?challenge=hard"], ["guess-duel", "?room=AB12CD"]]) {
        const response = middleware(new NextRequest(`https://appai.info${prefix}/games/${slug}/${search}`, {
          method, headers: { "accept-language": "ja" },
        }));
        assert.equal(response.status, 307);
        const language = prefix && !search.includes("locale=") ? "&locale=zh-TW" : "";
        assert.equal(response.headers.get("location"), `https://appai.info/games/${slug}/play${search}${language}`);
      }
    }
  } finally { hooks.deregister(); }
});
