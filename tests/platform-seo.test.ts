import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { locales } from "../src/i18n/routing.ts";
import { buildPlatformMetadata, platformUrl, platformAlternates, DEFAULT_SHARE_IMAGE } from "../src/lib/platform-seo.ts";

const expectedOpenGraphLocales = {
  en: "en_US", ja: "ja_JP", ko: "ko_KR", "zh-CN": "zh_CN", "zh-TW": "zh_TW",
  de: "de_DE", fr: "fr_FR", es: "es_ES", hi: "hi_IN",
};

test("each platform page has nine distinct translated titles and descriptions with self canonicals", () => {
  const allTitles = new Set<string>();
  for (const page of ["home", "tools", "apps", "websites"]) {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const locale of locales) {
      const messages = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), "utf8"));
      const path = page === "home" ? "/" : `/${page}`;
      const copy = messages.seo[page];
      const metadata = buildPlatformMetadata(locale, path, copy);
      assert.ok(copy.title.length > 10);
      assert.ok(copy.description.length > 25);
      assert.equal(metadata.title, copy.title);
      assert.equal(metadata.description, copy.description);
      assert.equal(metadata.alternates?.canonical, platformUrl(path, locale));
      assert.deepEqual(metadata.alternates?.languages, platformAlternates(path));
      assert.equal(Object.keys(metadata.alternates!.languages!).length, 10);
      assert.equal(metadata.openGraph?.title, copy.title);
      assert.equal(metadata.openGraph?.description, copy.description);
      assert.equal(metadata.openGraph?.locale, expectedOpenGraphLocales[locale]);
      assert.deepEqual(metadata.openGraph?.alternateLocale,
        locales.filter(value => value !== locale).map(value => expectedOpenGraphLocales[value]));
      assert.deepEqual(metadata.twitter?.images, [DEFAULT_SHARE_IMAGE]);
      titles.add(copy.title); descriptions.add(copy.description); allTitles.add(copy.title);
    }
    assert.equal(titles.size, 9, page);
    assert.equal(descriptions.size, 9, page);
  }
  assert.equal(allTitles.size, 36);
});

test("platform URLs remove query filters and omit the English prefix", () => {
  assert.equal(platformUrl("/", "en"), "https://appai.info/");
  assert.equal(platformUrl("/", "fr"), "https://appai.info/fr");
  for (const query of ["?kind=apps", "?category=GAMES", "?type=personal"]) {
    assert.equal(platformUrl(`/apps${query}`, "en"), "https://appai.info/apps");
    assert.equal(platformUrl(`/websites${query}`, "de"), "https://appai.info/de/websites");
  }
  assert.equal(platformUrl("/apps/demo/", "ja", "https://example.com/"), "https://example.com/ja/apps/demo");
  assert.equal(platformAlternates("/apps/demo")["x-default"], "https://appai.info/apps/demo");
});
