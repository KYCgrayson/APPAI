import test from "node:test";
import assert from "node:assert/strict";
import { buildSitemapEntries, splitSitemapEntries, sitemapXml, PLATFORM_CONTENT_MODIFIED, SITEMAP_URL_LIMIT, SITEMAP_CACHE_BYTE_LIMIT } from "../src/lib/sitemap-entries.ts";
import { GAMES, TABLETOP_COLLECTION, gamePageHref, isPlayableGame } from "../src/lib/games-catalog.ts";
import { platformAlternates, platformUrl } from "../src/lib/platform-seo.ts";
import { locales } from "../src/i18n/routing.ts";

const updatedAt = new Date("2025-04-01T12:00:00Z");
const root = { slug: "site", parentSlug: null, organizationId: "fixture", locale: "en", isDefault: true, updatedAt };

test("sitemap uses stable static dates, true update times and excludes login and external canonicals", () => {
  const entries = buildSitemapEntries([
    { ...root, privacyPolicy: "Privacy" },
    { ...root, slug: "external", canonicalUrl: "https://example.org/official", privacyPolicy: "Privacy" },
  ], [{ id: "demo", updatedAt, hostedPageSlug: null }]);
  assert.equal(entries.length, 11 * 9 + 11 + 3 + 9); // platform locales, spec, hosted/policies, app locales
  assert.ok(!entries.some(entry => /login/.test(entry.url) || entry.url.endsWith("/p/external")));
  assert.ok(entries.some(entry => entry.url.endsWith("/p/external/privacy")));
  assert.equal(entries.find(entry => entry.url === "https://appai.info/")?.lastModified, undefined);
  assert.equal(entries.find(entry => entry.url.endsWith("/p/site"))?.lastModified, updatedAt);
  assert.equal(entries.find(entry => entry.url.endsWith("/apps/demo"))?.lastModified, updatedAt);
  assert.deepEqual(entries.filter(entry => !entry.url.includes("/p/external/")), buildSitemapEntries([{ ...root, privacyPolicy: "Privacy" }], [{ id: "demo", updatedAt, hostedPageSlug: null }]));
});

test("sitemap includes live and Beta own-game pages with alternates, without play URLs or soon entries", () => {
  const origin = "https://example.com";
  const assertGames = () => {
    const entries = buildSitemapEntries([], [], origin);
    const games = entries.filter((entry) => entry.url.startsWith(`${origin}/games/`));
    assert.equal(games.length, GAMES.filter(isPlayableGame).length + 1);
    const collection = games.find((entry) => entry.url === platformUrl(gamePageHref(TABLETOP_COLLECTION), "en", origin));
    assert.ok(collection);
    assert.deepEqual(collection.alternates?.languages, platformAlternates(gamePageHref(TABLETOP_COLLECTION), origin));
    for (const entry of [...games, entries.find((entry) => entry.url === `${origin}/games`)!]) {
      assert.deepEqual(Object.keys(entry.alternates!.languages!).sort(), [...locales, "x-default"].sort());
    }
    for (const game of GAMES) {
      const entry = games.find((item) => item.url === platformUrl(gamePageHref(game), "en", origin));
      if (!isPlayableGame(game)) { assert.equal(entry, undefined); continue; }
      assert.ok(entry, game.slug);
      assert.equal(entry.lastModified, PLATFORM_CONTENT_MODIFIED);
      assert.deepEqual(entry.alternates?.languages, platformAlternates(gamePageHref(game), origin));
    }
    assert.ok(entries.every((entry) => !entry.url.includes("/play") && !entry.url.includes("?")));
  };
  assertGames();
  const original = GAMES[0].status;
  try { GAMES[0].status = "soon"; assertGames(); }
  finally { GAMES[0].status = original; }
});

test("sitemap child and policy alternates only reference reachable published variants", () => {
  const entries = buildSitemapEntries([
    root, { ...root, locale: "ja", isDefault: false, privacyPolicy: "Privacy" },
    { ...root, slug: "site-faq", parentSlug: "site", locale: "ja", isDefault: true },
    { ...root, slug: "site-faq", parentSlug: "site", locale: "fr", isDefault: false },
    { ...root, slug: "orphan", parentSlug: "missing" },
  ], []);
  assert.ok(!entries.some(entry => /\/p\/.*\/fr|orphan/.test(entry.url)));
  assert.deepEqual(entries.find(entry => entry.url.endsWith("site-faq"))?.alternates?.languages, {
    ja: "https://appai.info/p/site/site-faq", "x-default": "https://appai.info/p/site/site-faq",
  });
  assert.deepEqual(entries.find(entry => entry.url.endsWith("privacy"))?.alternates?.languages, { ja: "https://appai.info/p/site/ja/privacy" });
});

test("sitemap shards never exceed 45000 URLs and cover all entries exactly once", () => {
  for (const count of [0, 1, 44999, 45000, 45001, 90001]) {
    const entries = Array.from({ length: count }, (_, i) => ({ url: `https://appai.info/p/page-${i}` }));
    const shards = splitSitemapEntries(entries);
    assert.ok(shards.length >= Math.max(1, Math.ceil(count / SITEMAP_URL_LIMIT)));
    assert.ok(shards.every(shard => shard.length <= 45000));
    assert.ok(shards.every(shard => Buffer.byteLength(JSON.stringify(shard)) <= SITEMAP_CACHE_BYTE_LIMIT));
    assert.deepEqual(shards.flat(), entries);
  }
});

test("sitemap serialization escapes XML text and hreflang attributes", () => {
  const xml = sitemapXml([{ url: "https://appai.info/p/a?x=1&y=<2>", lastModified: updatedAt,
    priority: 0, alternates: { languages: { en: 'https://appai.info/p/a?x="1"&y=2' } } }]);
  assert.match(xml, /<loc>https:\/\/appai.info\/p\/a\?x=1&amp;y=&lt;2&gt;<\/loc>/);
  assert.match(xml, /href="https:\/\/appai.info\/p\/a\?x=&quot;1&quot;&amp;y=2"/);
  assert.match(xml, /<lastmod>2025-04-01T12:00:00.000Z<\/lastmod>/);
  assert.match(xml, /<priority>0<\/priority>/);
});


test("app lastmod follows the bound locale variant, fallback and organization without a platform date floor", () => {
  const jaDate = new Date("2025-05-01");
  const fallbackDate = new Date("2025-04-20");
  const appDate = new Date("2025-04-15");
  const pages = [{ ...root, updatedAt: fallbackDate }, { ...root, locale: "ja-JP", isDefault: false, updatedAt: jaDate },
    { ...root, organizationId: "other", updatedAt: new Date("2026-12-01") }];
  const apps = [{ id: "bound", organizationId: "fixture", hostedPageSlug: root.slug, updatedAt: appDate },
    { id: "standalone", organizationId: "fixture", hostedPageSlug: null, updatedAt: appDate },
    { id: "newer-app", organizationId: "fixture", hostedPageSlug: root.slug, updatedAt: new Date("2025-06-01") }];
  const entries = buildSitemapEntries(pages, apps);
  for (const locale of locales) {
    assert.equal(entries.find(entry => entry.url === platformUrl("/apps/bound", locale))?.lastModified, locale === "ja" ? jaDate : fallbackDate);
    assert.equal(entries.find(entry => entry.url === platformUrl("/apps/standalone", locale))?.lastModified, appDate);
    assert.equal(entries.find(entry => entry.url === platformUrl("/apps/newer-app", locale))?.lastModified, apps[2].updatedAt);
  }
});
