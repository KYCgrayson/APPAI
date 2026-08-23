import assert from "node:assert/strict";
import test from "node:test";

import {
  isHighlighted,
  toggleHighlightRange,
  type HighlightRange,
} from "../src/templates/shared/video/types.ts";

test("isHighlighted covers the half-open range", () => {
  const r: HighlightRange[] = [[2, 4]];
  assert.ok(!isHighlighted(r, 1));
  assert.ok(isHighlighted(r, 2));
  assert.ok(isHighlighted(r, 3));
  assert.ok(!isHighlighted(r, 4));
  assert.ok(!isHighlighted(undefined, 0));
});

test("dragging a span adds it", () => {
  assert.deepEqual(toggleHighlightRange(undefined, 3, 5), [[3, 5]]);
});

test("tapping inside a mark clears it — same gesture both ways", () => {
  assert.deepEqual(toggleHighlightRange([[3, 5]], 4, 5), []);
  assert.deepEqual(toggleHighlightRange([[0, 2], [3, 5]], 3, 4), [[0, 2]]);
});

test("a tap outside every mark adds a one-character mark", () => {
  assert.deepEqual(toggleHighlightRange([[3, 5]], 0, 1), [[0, 1], [3, 5]]);
});

test("results stay sorted, which is what the backend validates", () => {
  assert.deepEqual(toggleHighlightRange([[6, 8]], 1, 3), [[1, 3], [6, 8]]);
});

test("overlapping and touching ranges are folded together", () => {
  // Overlapping would emit nested spans; touching renders identically to
  // one range, so both collapse.
  assert.deepEqual(toggleHighlightRange([[0, 3]], 2, 5), [[0, 5]]);
  assert.deepEqual(toggleHighlightRange([[0, 2]], 2, 4), [[0, 4]]);
});

test("an empty or reversed range changes nothing", () => {
  assert.deepEqual(toggleHighlightRange([[1, 2]], 3, 3), [[1, 2]]);
  assert.deepEqual(toggleHighlightRange([[1, 2]], 4, 2), [[1, 2]]);
});

test("the input is never mutated", () => {
  const before: HighlightRange[] = [[0, 2]];
  toggleHighlightRange(before, 4, 6);
  assert.deepEqual(before, [[0, 2]]);
});
