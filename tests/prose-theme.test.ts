import assert from "node:assert/strict";
import test from "node:test";
import { proseThemeVariables } from "../src/lib/prose-theme.ts";

function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = hex.match(/[a-f\d]{2}/gi)!.map(pair => parseInt(pair, 16) / 255);
    const linear = channels.map(s => s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

test("prose theme variables accept only the API's six-digit opaque hex colours", () => {
  for (const invalid of [undefined, null, 123, {}, "", "red", "#abc", "#ffffffff", " #123456", "#123456\n", "#123456; color: red", '" onmouseover="alert(1)', "var(--other)"]) {
    assert.equal(proseThemeVariables(invalid), undefined);
  }
  assert.equal(proseThemeVariables("#ABCDEF")?.["--page-theme"], "#ABCDEF");
});

test("readable theme links keep their original colour when contrast already passes", () => {
  assert.equal(proseThemeVariables("#1d4ed8")?.["--page-theme-link-light"], "#1d4ed8");
  assert.equal(proseThemeVariables("#93c5fd")?.["--page-theme-link-dark"], "#93c5fd");
});

test("theme links meet AA on both alternating backgrounds, including dark red and pale yellow", () => {
  const themes = ["#7f1d1d", "#fde68a"];
  for (let r = 0; r <= 255; r += 51) {
    for (let g = 0; g <= 255; g += 51) {
      for (let b = 0; b <= 255; b += 51) {
        themes.push(`#${[r, g, b].map(channel => channel.toString(16).padStart(2, "0")).join("")}`);
      }
    }
  }
  for (const theme of themes) {
    const vars = proseThemeVariables(theme)!;
    for (const background of ["#ffffff", "#f9fafb"]) {
      assert.ok(contrast(vars["--page-theme-link-light"], background) >= 4.5, `${theme} on ${background}`);
    }
    for (const background of ["#111827", "#1f2937"]) {
      assert.ok(contrast(vars["--page-theme-link-dark"], background) >= 4.5, `${theme} on ${background}`);
    }
  }
  assert.ok(contrast("#2563eb", "#ffffff") >= 4.5);
  assert.ok(contrast("#93c5fd", "#111827") >= 4.5);
});
