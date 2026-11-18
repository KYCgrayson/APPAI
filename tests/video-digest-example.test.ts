import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ICON_NAMES } from "../src/components/ui/icon-data.ts";
import { checkPagePreview } from "../src/lib/page-preview.ts";

for (const filename of [
  "video-digest.example.json",
  "video-digest-youtube.example.json",
  "video-digest-mp4.example.json",
]) {
  test(`${filename} passes the API preview validator without warnings`, () => {
    const payload: unknown = JSON.parse(readFileSync(new URL(`../docs/examples/${filename}`, import.meta.url), "utf8"));
    const result = checkPagePreview(payload, ICON_NAMES);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
  });
}
