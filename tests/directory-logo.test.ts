import assert from "node:assert/strict";
import test from "node:test";
import { directoryLogo, directoryTileColors, firstGrapheme, logosFirst } from "../src/lib/directory-logo.ts";

test("logo choice preserves App logos, then headerLogo, content.logo, hero logos; never photos", () => {
  const page = { headerLogo: "/header.png", content: { logo: "/primary.png", sections: [
    { type: "gallery", data: { logo: "/not-a-logo.png" } },
    { type: "hero", data: { logo: " " } }, { type: "hero", data: { logo: "/hero.png" } },
  ] } };
  assert.equal(directoryLogo("/existing.png", page), "/existing.png");
  assert.equal(directoryLogo(null, page), "/header.png");
  page.headerLogo = " ";
  assert.equal(directoryLogo(null, page), "/primary.png");
  page.content.logo = "";
  assert.equal(directoryLogo(null, page), "/hero.png");
  for (const content of [null, {}, "legacy", { logo: 42, sections: [null, {}, { type: "hero" }] },
    { heroImage: "/photo.jpg", sections: [{ type: "hero", data: { image: "/photo.jpg" } }] }]) {
    assert.equal(directoryLogo(null, { content }), null);
  }
});

test("first character is a complete Latin, CJK or emoji grapheme", () => {
  for (const [name, expected] of [["App", "A"], [" hello", "h"], ["éclair", "é"], ["e\u0301clair", "e\u0301"],
    ["網站", "網"], ["𠮷野", "𠮷"], ["👩🏽‍💻 Tools", "👩🏽‍💻"], ["👨‍👩‍👧‍👦 Family", "👨‍👩‍👧‍👦"],
    ["🇹🇼 Taiwan", "🇹🇼"], ["1️⃣ One", "1️⃣"], ["", "?"], ["  ", "?"]]) {
    assert.equal(firstGrapheme(name), expected);
  }
});

function luminance(hex: string) {
  const [r, g, b] = hex.slice(1).match(/../g)!.map(pair => {
    const c = parseInt(pair, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

test("tile uses valid page colour and the higher AA contrast foreground; invalid values use slate", () => {
  for (const input of [undefined, null, "", "red", "#fff", "#12345600", "#12345g", "var(--brand)", "transparent"]) {
    assert.equal(directoryTileColors(input).backgroundColor, "#334155");
  }
  assert.deepEqual(directoryTileColors("#000000"), { backgroundColor: "#000000", color: "#ffffff" });
  assert.deepEqual(directoryTileColors("#FFFFFF"), { backgroundColor: "#FFFFFF", color: "#000000" });
  // Exercise saturated colours and the black/white switching boundary.
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
    const { backgroundColor, color } = directoryTileColors(hex);
    assert.equal(backgroundColor, hex);
    const values = [luminance(backgroundColor), luminance(color)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, hex);
  }
});

test("logo-first partition is stable, non-mutating, and counts fallback logos as real logos", () => {
  const items = [null, "/a.png", "", "/b.png", null].map((logoUrl, id) => ({ logoUrl, id }));
  assert.deepEqual(logosFirst(items, x => x.logoUrl).map(x => x.id), [1, 3, 0, 2, 4]);
  assert.deepEqual(items.map(x => x.id), [0, 1, 2, 3, 4]);
  assert.deepEqual(logosFirst([], () => null), []);
});
