import assert from "node:assert/strict";
import test from "node:test";

import { matchPreferredLocale, matchSupportedLocale, parseAcceptLanguage } from "../src/lib/accept-language.ts";

const PLATFORM = ["en", "ja", "ko", "zh-CN", "zh-TW", "de", "fr", "es", "hi"] as const;

test("orders languages by descending q-value, not by position", () => {
  assert.deepEqual(parseAcceptLanguage("en;q=0.5,zh-TW,ja;q=0.8"), ["zh-TW", "ja", "en"]);
});

test("a plain header keeps its written order", () => {
  assert.deepEqual(parseAcceptLanguage("zh-TW,zh;q=0.9,en;q=0.8"), ["zh-TW", "zh", "en"]);
});

test("drops the wildcard and anything explicitly refused", () => {
  assert.deepEqual(parseAcceptLanguage("*,de;q=0.9"), ["de"]);
  assert.deepEqual(parseAcceptLanguage("fr;q=0,de"), ["de"]);
});

test("survives a malformed header instead of throwing", () => {
  assert.deepEqual(parseAcceptLanguage("de;q=abc"), []);
  assert.deepEqual(parseAcceptLanguage(""), []);
  assert.deepEqual(parseAcceptLanguage(null), []);
  assert.deepEqual(parseAcceptLanguage(undefined), []);
});

test("matches a platform locale exactly, ignoring case", () => {
  assert.equal(matchSupportedLocale("zh-TW", PLATFORM), "zh-TW");
  assert.equal(matchSupportedLocale("zh-tw", PLATFORM), "zh-TW");
});

test("an unshipped region falls back to the bare language we do ship", () => {
  assert.equal(matchSupportedLocale("de-AT", PLATFORM), "de");
  assert.equal(matchSupportedLocale("en-GB", PLATFORM), "en");
});

test("a language we do not ship has no match — callers use the default", () => {
  assert.equal(matchSupportedLocale("th", PLATFORM), null);
  assert.equal(matchSupportedLocale("pt-BR", PLATFORM), null);
  assert.equal(matchSupportedLocale(undefined, PLATFORM), null);
  assert.equal(matchSupportedLocale("", PLATFORM), null);
});

test("zh-HK is served Traditional Chinese rather than dropping to English", () => {
  // "zh" is not itself a platform locale, so the primary-subtag tier must still
  // find a zh-* entry; zh-CN sorts first in the platform list.
  assert.equal(matchSupportedLocale("zh-HK", PLATFORM), "zh-CN");
});

test("an earlier preference wins over a closer match to a later one", () => {
  // "ja" is the visitor's first choice and we ship it, so a later "en-US"
  // must not win just because it also matches.
  assert.equal(matchPreferredLocale(["ja", "en-US"], PLATFORM), "ja");
});

test("falls through preferences we do not ship", () => {
  assert.equal(matchPreferredLocale(["th", "vi", "de"], PLATFORM), "de");
  assert.equal(matchPreferredLocale(["th", "vi"], PLATFORM), null);
  assert.equal(matchPreferredLocale([], PLATFORM), null);
});

test("hosted-page variants are matched the same way as platform locales", () => {
  // The hosted-page redirect path passes publisher-supplied locales here.
  assert.equal(matchPreferredLocale(["zh"], ["en", "zh-CN"]), "zh-CN");
  assert.equal(matchPreferredLocale(["en-US"], ["en", "ja"]), "en");
});
