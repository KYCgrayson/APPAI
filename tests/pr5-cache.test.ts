import test from "node:test";
import assert from "node:assert/strict";
import { registerPr5CacheFixture } from "./helpers/pr5-public-loader.mjs";
const paths: unknown[][] = [];
const tags: unknown[][] = [];
const state = { fail: false, paths, tags };
const hook = registerPr5CacheFixture(state);
test.after(() => hook.deregister());
const { revalidateSeoIndexes } = await import("../src/lib/revalidate-seo.ts");
test("cache invalidation immediately expires sitemap and revalidates the hosted layout and discovery routes", () => {
  assert.equal(revalidateSeoIndexes("fixture-child"), true);
  assert.deepEqual(tags, [["seo-sitemap", { expire: 0 }]]);
  assert.deepEqual(paths, [["/sitemap.xml"], ["/llms.txt"], ["/llms-full.txt"], ["/p/[...segments]", "layout"]]);
  state.fail = true;
  const errors = test.mock.method(console, "error", () => {});
  try {
    assert.equal(revalidateSeoIndexes("fixture-child"), false);
    assert.equal(errors.mock.callCount(), 5);
  } finally { errors.mock.restore(); state.fail = false; }
});
