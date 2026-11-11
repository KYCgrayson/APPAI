import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { GAMES, OWN_GAME_SLUGS, GAME_PAGE_SLUGS, RESERVED_GAME_SLUGS, STATIC_GAME_PATH_SEGMENTS, TABLETOP_COLLECTION, getOwnGame, getGamesCopy, gamePageHref, gamePlayHref, isPlayableGame, isStaticGamePath } from "../src/lib/games-catalog.ts";
import { GAME_PAGE_LOCALES, gameContentLocale, getGamePageCopy, getGamePageLabels, getGamesHubFaq } from "../src/lib/games-pages-copy.ts";
import { buildGamePageMetadata, buildGamePageJsonLd, buildCollectionPageJsonLd, gameBreadcrumbs } from "../src/lib/games-page-seo.ts";
import { platformAlternates, platformUrl } from "../src/lib/platform-seo.ts";
import { locales } from "../src/i18n/routing.ts";
import { serializeJsonLd } from "../src/lib/json-ld.ts";

test("own games have distinct detail and locale-free play URLs", () => {
  assert.deepEqual(OWN_GAME_SLUGS, ["river-crossing", "night-bridge", "water-pouring", "guess-duel", "werewolf"]);
  for (const game of GAMES) {
    assert.equal(getOwnGame(game.slug), game);
    assert.equal(gamePageHref(game), `/games/${game.slug}`);
    for (const locale of locales) {
      const expectedLanguage = locale === "zh-TW" ? game.localeParam.zh : locale;
      const play = new URL(gamePlayHref(game, locale), "https://appai.info");
      assert.equal(play.pathname, `/games/${game.slug}/play`);
      assert.equal(play.searchParams.get(game.localeParam.name), expectedLanguage);
      assert.equal(play.searchParams.get("game"), game.puzzle ?? null);
      assert.equal(platformUrl(gamePageHref(game), locale), `https://appai.info${locale === "en" ? "" : `/${locale}`}/games/${game.slug}`);
    }
    assert.ok(isPlayableGame({ ...game, status: "live" }));
    assert.ok(isPlayableGame({ ...game, status: "beta" }));
    assert.equal(isPlayableGame({ ...game, status: "soon" }), false);
  }
  for (const slug of ["unknown", "covers", "toString", "__proto__"]) assert.equal(getOwnGame(slug), undefined);
});

test("tabletop collection is page-only, while three puzzle pages share one existing build", () => {
  assert.ok(GAME_PAGE_SLUGS.includes(TABLETOP_COLLECTION.slug));
  assert.ok(RESERVED_GAME_SLUGS.includes(TABLETOP_COLLECTION.slug));
  assert.ok(!OWN_GAME_SLUGS.includes(TABLETOP_COLLECTION.slug));
  assert.ok(!STATIC_GAME_PATH_SEGMENTS.includes(TABLETOP_COLLECTION.slug));
  assert.equal(getOwnGame(TABLETOP_COLLECTION.slug), undefined);
  assert.equal(isStaticGamePath("/games/tabletop-puzzles/play"), false);
  assert.equal(existsSync(new URL("../public/games/tabletop-puzzles", import.meta.url)), false);
  const puzzles = GAMES.filter((game) => game.puzzle);
  assert.deepEqual(puzzles.map((game) => game.puzzle), ["river", "bridge", "water"]);
  assert.ok(puzzles.every((game) => game.buildSlug === "river-crossing"));
  for (const game of GAMES) assert.ok(existsSync(new URL(`../public${game.cover}`, import.meta.url)));
  for (const slug of OWN_GAME_SLUGS) assert.ok(RESERVED_GAME_SLUGS.includes(slug));
});

test("only locale-free own-game descendants and covers bypass next-intl", () => {
  for (const path of ["/games/covers/river-crossing.svg", "/games/covers/"]) assert.ok(isStaticGamePath(path), path);
  for (const game of GAMES) {
    for (const tail of ["play", "play/", "assets/file.js", "src/app.js", "index.html"]) {
      assert.ok(isStaticGamePath(`/games/${game.slug}/${tail}`), tail);
    }
    for (const locale of ["", ...locales.map((value) => `/${value}`)]) {
      assert.equal(isStaticGamePath(`${locale}/games/${game.slug}`), false);
      assert.equal(isStaticGamePath(`${locale}/games/${game.slug}/`), false);
    }
  }
  for (const path of ["/games", "/games/", "/games/unknown/play", "/games/river-crossing-other/play", "/p/river-crossing/play", "/zh-TW/games/river-crossing/play", "/games/covers-other/a.svg"]) {
    assert.equal(isStaticGamePath(path), false, path);
  }
});

test("all nine locales have complete translated pages, cards, hub, navigation and at least four FAQs", () => {
  assert.deepEqual([...GAME_PAGE_LOCALES].sort(), [...locales].sort());
  function noEmptyStrings(value: unknown, path: string) {
    if (typeof value === "string") assert.ok(value.trim(), path);
    else if (Array.isArray(value)) {
      assert.ok(value.length, path);
      value.forEach((item, index) => noEmptyStrings(item, `${path}[${index}]`));
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) noEmptyStrings(item, `${path}.${key}`);
    }
  }
  for (const locale of GAME_PAGE_LOCALES) {
    assert.equal(gameContentLocale(locale), locale);
    const hub = getGamesCopy(locale);
    const englishHub = getGamesCopy("en");
    noEmptyStrings(hub, `${locale}.hub`);
    noEmptyStrings(getGamePageLabels(locale), `${locale}.labels`);
    noEmptyStrings(getGamesHubFaq(locale), `${locale}.hubFaq`);
    assert.ok(getGamesHubFaq(locale).length >= 4);
    if (locale !== "en") {
      for (const key of ["metaTitle", "metaDescription", "label", "title", "play", "details", "howToPlay", "players", "ages", "soon", "nav"] as const) {
        assert.notEqual(hub[key], englishHub[key], `${locale}.hub.${key}`);
      }
      for (const key of Object.keys(getGamePageLabels("en")) as (keyof ReturnType<typeof getGamePageLabels>)[]) {
        assert.notEqual(getGamePageLabels(locale)[key], getGamePageLabels("en")[key], `${locale}.labels.${key}`);
      }
      for (const faq of getGamesHubFaq(locale)) assert.ok(!getGamesHubFaq("en").some((en) => en.answer === faq.answer));
    }
    const titles = new Set();
    for (const game of [...GAMES, TABLETOP_COLLECTION]) {
      const copy = getGamePageCopy(locale, game.slug);
      const summary = hub.games[game.slug];
      assert.ok(copy, `${locale}/${game.slug}`);
      noEmptyStrings(copy, `${locale}.${game.slug}`);
      assert.ok(summary.name && summary.tagline && summary.players && summary.ages);
      assert.ok(summary.howToPlay.length);
      assert.ok(copy.faq.length >= 4);
      assert.equal(new Set(copy.faq.map((item) => item.question)).size, copy.faq.length);
      for (const item of copy.faq) assert.ok(item.question.trim() && item.answer.trim());
      if (locale !== "en") {
        const english = getGamePageCopy("en", game.slug);
        for (const key of ["metaTitle", "description", "intro", "background", "genre"] as const) assert.notEqual(copy[key], english[key], `${locale}/${game.slug}.${key}`);
        for (const key of ["name", "tagline"] as const) assert.notEqual(summary[key], englishHub.games[game.slug][key]);
        for (const step of summary.howToPlay) assert.ok(!englishHub.games[game.slug].howToPlay.includes(step));
        for (const item of copy.faq) assert.ok(!english.faq.some((en) => en.answer === item.answer), `${locale}/${game.slug}: English FAQ answer`);
      }
      if ("status" in game && game.status === "beta") assert.match(copy.background, /Beta/);
      titles.add(copy.metaTitle);
    }
    assert.equal(titles.size, GAME_PAGE_SLUGS.length);
  }
  for (const locale of ["unknown", "__proto__", "toString"]) {
    assert.equal(gameContentLocale(locale), "en");
    for (const game of GAMES) assert.equal(getGamePageCopy(locale, game.slug), getGamePageCopy("en", game.slug));
  }
});

test("game and collection metadata use canonical pages, nine hreflangs and absolute cover images", () => {
  for (const game of [...GAMES, TABLETOP_COLLECTION]) for (const locale of locales) {
    const metadata = buildGamePageMetadata(game, locale);
    const copy = getGamePageCopy(locale, game.slug);
    const cover = `https://appai.info${game.cover}`;
    assert.equal(metadata.title, copy.metaTitle);
    assert.equal(metadata.description, copy.description);
    assert.equal(metadata.alternates?.canonical, platformUrl(gamePageHref(game), locale));
    assert.deepEqual(metadata.alternates?.languages, platformAlternates(gamePageHref(game)));
    assert.deepEqual(Object.keys(metadata.alternates!.languages!).sort(), [...locales, "x-default"].sort());
    assert.equal(metadata.openGraph?.url, metadata.alternates?.canonical);
    assert.deepEqual(metadata.openGraph?.images, [{ url: cover, width: 640, height: 360, alt: getGamesCopy(locale).games[game.slug].name }]);
    assert.deepEqual(metadata.twitter?.images, [cover]);
    assert.ok(metadata.twitter && "card" in metadata.twitter);
    assert.equal(metadata.twitter.card, "summary_large_image");
  }
});

test("VideoGame and FAQPage JSON-LD matches the visible copy and game facts", () => {
  for (const game of GAMES) for (const locale of locales) {
    const [video, faq, breadcrumbs] = JSON.parse(serializeJsonLd(buildGamePageJsonLd(game, locale)));
    const copy = getGamePageCopy(locale, game.slug);
    assert.equal(video["@context"], "https://schema.org");
    assert.equal(video["@type"], "VideoGame");
    assert.equal(video.name, getGamesCopy(locale).games[game.slug].name);
    assert.equal(video.description, copy.description);
    assert.equal(video.url, platformUrl(gamePageHref(game), locale));
    assert.equal(video.image, `https://appai.info${game.cover}`);
    assert.equal(video.genre, copy.genre);
    assert.deepEqual(video.numberOfPlayers, { "@type": "QuantitativeValue", minValue: game.playerRange.min, maxValue: game.playerRange.max });
    assert.deepEqual(video.audience, { "@type": "PeopleAudience", suggestedMinAge: game.minAge });
    assert.equal(video.typicalAgeRange, `${game.minAge}-`);
    assert.equal(video.inLanguage, gameContentLocale(locale));
    assert.equal(video.isAccessibleForFree, true);
    assert.equal(video.applicationCategory, "Game");
    assert.equal(video.operatingSystem, "Any");
    assert.equal(faq["@context"], "https://schema.org");
    assert.equal(faq["@type"], "FAQPage");
    assert.equal(faq.url, video.url);
    assert.deepEqual(faq.mainEntity, copy.faq.map((item) => ({
      "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer },
    })));
    assert.equal(breadcrumbs["@type"], "BreadcrumbList");
    assert.deepEqual(breadcrumbs.itemListElement, gameBreadcrumbs(locale, game.slug).map(({ name, href }, index) => ({
      "@type": "ListItem", position: index + 1, name, item: platformUrl(href, locale),
    })));
  }
});

test("game JSON-LD escapes hostile description and FAQ text without changing parsed values", () => {
  const copy = getGamePageCopy("en", GAMES[0].slug);
  const original = { description: copy.description, faq: copy.faq };
  const hostile = '</script><script>& "quoted"\u2028\u2029';
  try {
    copy.description = hostile;
    copy.faq = [{ question: hostile, answer: hostile }];
    const json = serializeJsonLd(buildGamePageJsonLd(GAMES[0], "en"));
    assert.doesNotMatch(json, /[<>&\u2028\u2029]/);
    assert.match(json, /\\u003c/);
    assert.match(json, /\\u003e/);
    assert.match(json, /\\u0026/);
    const [video, faq] = JSON.parse(json);
    assert.equal(video.description, hostile);
    assert.equal(faq.mainEntity[0].name, hostile);
    assert.equal(faq.mainEntity[0].acceptedAnswer.text, hostile);
  } finally { Object.assign(copy, original); }
});

test("static HTML asset URLs resolve to existing game files when opened at /play", () => {
  for (const game of GAMES) {
    const html = readFileSync(new URL(`../public/games/${game.buildSlug}/index.html`, import.meta.url), "utf8");
    const play = new URL(gamePlayHref(game, "en"), "https://appai.info");
    const baseHref = html.match(/<base\b[^>]*href="([^"]+)"/)?.[1];
    const base = baseHref ? new URL(baseHref, play) : play;
    const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1])
      .filter((href) => /\.(?:js|css)$/.test(href));
    assert.ok(assets.length > 0);
    for (const asset of assets) {
      const url = new URL(asset, base);
      assert.equal(url.origin, play.origin);
      assert.ok(url.pathname.startsWith(`/games/${game.buildSlug}/`));
      assert.ok(existsSync(new URL(`../public${url.pathname}`, import.meta.url)), url.pathname);
    }
  }
});

test("collection metadata and structured data describe three pages, not a fourth game", () => {
  for (const locale of locales) {
    const metadata = buildGamePageMetadata(TABLETOP_COLLECTION, locale);
    assert.equal(metadata.alternates?.canonical, platformUrl("/games/tabletop-puzzles", locale));
    const [collection, faq, breadcrumb] = buildCollectionPageJsonLd(locale);
    assert.equal(collection["@type"], "CollectionPage");
    assert.equal(faq["@type"], "FAQPage");
    assert.equal(breadcrumb["@type"], "BreadcrumbList");
    const data = JSON.parse(JSON.stringify(collection));
    assert.deepEqual(data.mainEntity.itemListElement.map((item: { url: string }) => item.url),
      GAMES.filter((game) => game.puzzle).map((game) => platformUrl(gamePageHref(game), locale)));
  }
});


test("Night Bridge tells the fire story in all nine locales without implying a real-time countdown", () => {
  const fireWords: Record<string, RegExp> = { en: /fire/i, es: /fuego/i, "zh-TW": /火/, "zh-CN": /火/, ja: /火/, ko: /불/, de: /Feuer/, fr: /feu/i, hi: /आग/ };
  for (const locale of GAME_PAGE_LOCALES) {
    const copy = getGamePageCopy(locale, "night-bridge"), card = getGamesCopy(locale).games["night-bridge"], fire = fireWords[locale];
    for (const field of ["intro", "background"] as const) assert.match(copy[field], fire, `${locale}.${field}`);
    assert.match(card.tagline, fire, `${locale}.tagline`);
    assert.ok(card.howToPlay.some(step => fire.test(step)), `${locale}.howToPlay`);
    assert.ok(copy.faq.some(item => fire.test(item.answer)), `${locale}.faq`);
  }
});
