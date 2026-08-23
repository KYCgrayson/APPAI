import assert from "node:assert/strict";
import test from "node:test";

import {
  isScriptSibling,
  swapPrimaryScript,
  zhScriptOf,
  zhSiblingOf,
  type ScriptSwapState,
} from "../src/templates/shared/video/types.ts";

const sub = (id: number, text: string) => ({ id, start: id, end: id + 1, text });

const baseStyle = {
  display: "bilingual" as const,
  primary_language: "zh-Hant",
  secondary_language: "en",
  font_family: "PingFang TC",
  font_size_px: 54,
  color: "#ffffff",
  position: "bottom" as const,
  animation: "none" as const,
};

const state = (over: Partial<ScriptSwapState> = {}): ScriptSwapState => ({
  subtitles: [sub(0, "這裡的頭髮")],
  translations: {
    "zh-Hans": [sub(0, "这里的头发")],
    en: [sub(0, "The hair here")],
  },
  style: baseStyle,
  ...over,
});

test("zhScriptOf reads only the script subtag", () => {
  assert.equal(zhScriptOf("zh-Hans"), "Hans");
  assert.equal(zhScriptOf("ZH_hant"), "Hant");
  assert.equal(zhScriptOf("zh"), null);
  assert.equal(zhScriptOf("en"), null);
  assert.equal(zhScriptOf(null), null);
});

test("zhSiblingOf names the same language in the other script", () => {
  assert.equal(zhSiblingOf("zh-Hant"), "zh-Hans");
  assert.equal(zhSiblingOf("zh-Hans"), "zh-Hant");
  assert.equal(zhSiblingOf("en"), null);
});

test("only the two Chinese scripts count as siblings", () => {
  assert.ok(isScriptSibling("zh-Hans", "zh-Hant"));
  assert.ok(!isScriptSibling("zh-Hant", "zh-Hant"));
  assert.ok(!isScriptSibling("en", "zh-Hant"));
});

test("swapping promotes the sibling and keeps the outgoing track", () => {
  const next = swapPrimaryScript(state());
  assert.ok(next);
  assert.deepEqual(
    next.subtitles.map((s) => s.text),
    ["这里的头发"],
  );
  assert.equal(next.style.primary_language, "zh-Hans");
  // The Traditional track is not dropped — it moves into translations.
  assert.deepEqual(
    next.translations["zh-Hant"].map((s) => s.text),
    ["這裡的頭髮"],
  );
  assert.equal(next.translations["zh-Hans"], undefined);
  // The real translation is untouched.
  assert.ok(next.translations.en);
});

test("hand edits survive the swap and come back on swapping again", () => {
  const edited = state({ subtitles: [sub(0, "這裡的頭髮 (edited)")] });
  const once = swapPrimaryScript(edited);
  assert.ok(once);
  const back = swapPrimaryScript(once);
  assert.ok(back);
  assert.deepEqual(
    back.subtitles.map((s) => s.text),
    ["這裡的頭髮 (edited)"],
  );
  assert.equal(back.style.primary_language, "zh-Hant");
});

test("the bilingual secondary never ends up as the primary's other script", () => {
  // Reachable from a project saved before the picker filtered siblings.
  const bad = state({
    style: { ...baseStyle, secondary_language: "zh-Hans" },
  });
  const next = swapPrimaryScript(bad);
  assert.ok(next);
  assert.equal(next.style.primary_language, "zh-Hans");
  assert.equal(next.style.secondary_language, "en");
  assert.equal(next.style.display, "bilingual");
});

test("with no other language left, a colliding secondary drops to single", () => {
  const onlyChinese = state({
    translations: { "zh-Hans": [sub(0, "这里的头发")] },
    style: { ...baseStyle, secondary_language: "zh-Hans" },
  });
  const next = swapPrimaryScript(onlyChinese);
  assert.ok(next);
  assert.equal(next.style.display, "single");
  assert.equal(next.style.secondary_language, undefined);
});

test("nothing to swap when the source is not Chinese, or the sibling is absent", () => {
  assert.equal(
    swapPrimaryScript(
      state({ style: { ...baseStyle, primary_language: "en" } }),
    ),
    null,
  );
  // A backend without OpenCC ships no sibling; the toggle must stay inert.
  assert.equal(
    swapPrimaryScript(state({ translations: { en: [sub(0, "hi")] } })),
    null,
  );
});
