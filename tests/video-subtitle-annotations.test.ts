import assert from "node:assert/strict";
import test from "node:test";

import {
  ANNOTATION_PRESETS,
  ANNOTATION_PRESET_ORDER,
} from "../src/templates/shared/video/types.ts";

// The burn owns the real values; these must not drift from
// `_BUBBLE_PRESETS` in services/video-subtitle/app/pipeline/ffmpeg_burn.py,
// or the preview shows one card and the download another.
const BURN_PRESETS: Record<string, { background: string; color: string }> = {
  note: { background: "#FAEEDA", color: "#633806" },
  warm: { background: "#FAECE7", color: "#712B13" },
  cool: { background: "#E6F1FB", color: "#0C447C" },
  dark: { background: "#2C2C2A", color: "#F1EFE8" },
};

test("the preview presets match what the burn draws", () => {
  assert.deepEqual(ANNOTATION_PRESETS, BURN_PRESETS);
});

test("every preset is offered, in a stable order", () => {
  assert.deepEqual(ANNOTATION_PRESET_ORDER, ["note", "warm", "cool", "dark"]);
  assert.deepEqual(
    [...ANNOTATION_PRESET_ORDER].sort(),
    Object.keys(ANNOTATION_PRESETS).sort(),
  );
});

test("light cards carry dark text, so a bubble never reads as a subtitle", () => {
  // Subtitles are light text on a translucent dark plate. Bubbles invert
  // that; if a preset ever matched the subtitle look the two would blur.
  const luminance = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return (
      (0.2126 * ((n >> 16) & 255) +
        0.7152 * ((n >> 8) & 255) +
        0.0722 * (n & 255)) /
      255
    );
  };
  for (const [name, { background, color }] of Object.entries(
    ANNOTATION_PRESETS,
  )) {
    const contrast = Math.abs(luminance(background) - luminance(color));
    assert.ok(contrast > 0.4, `${name} needs readable contrast, got ${contrast}`);
  }
});
