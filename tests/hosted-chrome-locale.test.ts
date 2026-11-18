import test from "node:test";
import assert from "node:assert/strict";
import { hostedChromeLabels, resolveHostedChromeLocale } from "../src/lib/hosted-chrome-labels.ts";

for (const [languages, expected] of [
  [["en-US"], "en"], [["en"], "en"], [["zh-HK"], "zh-TW"],
  [["zh-MO"], "zh-TW"], [["zh-Hant-TW"], "zh-TW"], [["zh-SG"], "zh-CN"],
  [["zh-Hans-CN"], "zh-CN"], [["ja"], "ja"], [["fr-CA"], "fr"],
  [["pt-BR"], "pt-BR"], [["pt-PT"], "pt"], [["ZH-tw"], "zh-TW"],
  [["xx"], "zh-TW"], [[], "zh-TW"], [["xx", "ja", "en"], "ja"],
  [["ja", "en-US"], "ja"], [["", "xx"], "zh-TW"], [["zh"], "zh-TW"],
] as [string[], string][]) {
  test(`browser chrome locale ${JSON.stringify(languages)} → ${expected}`, () => {
    assert.equal(resolveHostedChromeLocale(languages, "zh-TW"), expected);
  });
}

test("unknown and empty browser preferences preserve any page locale and its existing label fallback", () => {
  for (const pageLocale of ["ja", "pt-BR", "fr-CA", "xx"]) {
    for (const languages of [[], ["xx", "zz"]]) {
      assert.equal(resolveHostedChromeLocale(languages, pageLocale), pageLocale);
      assert.deepEqual(hostedChromeLabels(resolveHostedChromeLocale(languages, pageLocale)), hostedChromeLabels(pageLocale));
    }
  }
});
