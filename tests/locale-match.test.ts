import assert from "node:assert/strict";
import test from "node:test";

import { groupByKey, pickByLocale } from "../src/lib/locale-match.ts";

const row = (locale: string, isDefault = false) => ({ locale, isDefault });

test("exact locale wins over everything else", () => {
  const rows = [row("en", true), row("zh-CN"), row("zh-TW")];
  assert.equal(pickByLocale(rows, "zh-TW")?.locale, "zh-TW");
  assert.equal(pickByLocale(rows, "zh-CN")?.locale, "zh-CN");
  assert.equal(pickByLocale(rows, "en")?.locale, "en");
});

test("exact match is case-insensitive on the region subtag", () => {
  assert.equal(pickByLocale([row("zh-tw")], "zh-TW")?.locale, "zh-tw");
  assert.equal(pickByLocale([row("zh-TW")], "zh-tw")?.locale, "zh-TW");
});

test("bare language beats a different region of the same language", () => {
  // A Traditional Chinese visitor is better served by generic zh than by
  // Simplified zh-CN, so the tiers must not collapse into one.
  const rows = [row("en", true), row("zh-CN"), row("zh")];
  assert.equal(pickByLocale(rows, "zh-TW")?.locale, "zh");

  const ptRows = [row("en", true), row("pt-BR"), row("pt")];
  assert.equal(pickByLocale(ptRows, "pt-PT")?.locale, "pt");
});

test("a different region is still better than falling back to the default", () => {
  const rows = [row("en", true), row("zh-CN")];
  assert.equal(pickByLocale(rows, "zh-TW")?.locale, "zh-CN");
});

test("an unrelated language never matches — the default is used instead", () => {
  const rows = [row("en", true), row("ja")];
  assert.equal(pickByLocale(rows, "zh-TW")?.locale, "en");
});

test("a bare request matches its own regional variants", () => {
  assert.equal(pickByLocale([row("en", true), row("zh-TW")], "zh")?.locale, "zh-TW");
});

test("falls back to the first row when nothing is marked default", () => {
  const rows = [row("ko"), row("ja")];
  assert.equal(pickByLocale(rows, "de")?.locale, "ko");
});

test("no rows means no localized copy — callers fall back to the App columns", () => {
  assert.equal(pickByLocale([], "zh-TW"), undefined);
});

test("primary subtag matching does not confuse languages sharing a prefix", () => {
  // "ja" and "jav" must not match each other via a naive startsWith.
  const rows = [row("en", true), row("jav")];
  assert.equal(pickByLocale(rows, "ja")?.locale, "en");
});

test("groupByKey buckets every row under its key, preserving order", () => {
  const rows = [
    { slug: "a", locale: "en" },
    { slug: "b", locale: "en" },
    { slug: "a", locale: "zh-TW" },
  ];
  const grouped = groupByKey(rows, (r) => r.slug);
  assert.deepEqual(
    grouped.get("a")?.map((r) => r.locale),
    ["en", "zh-TW"],
  );
  assert.deepEqual(
    grouped.get("b")?.map((r) => r.locale),
    ["en"],
  );
  assert.equal(grouped.get("missing"), undefined);
});
