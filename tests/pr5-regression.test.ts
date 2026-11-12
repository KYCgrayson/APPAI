import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHostedRenderLoader, registerHostedHeaders, registerDirectoryFixtures, registerSitemapFixtures } from "./helpers/hosted-render-loader.mjs";
import { captureF0 } from "./helpers/pr5-capture.mjs";
const hooks = [registerHostedRenderLoader(), registerHostedHeaders(), registerDirectoryFixtures({ translated: true }), registerSitemapFixtures()];
test.after(() => hooks.reverse().forEach(hook => hook.deregister()));
test("P1: consistent F0 data preserves the pre-PR HTML bytes for 12 URLs, sitemap shards and llms", async () => {
  // Captured by rendering 557445a's source with the same F0 database/clock fixtures.
  const { source, ...expected } = JSON.parse(readFileSync(new URL("./fixtures/pr5-f0-baseline.json", import.meta.url), "utf8"));
  assert.match(source, /557445a/);
  assert.equal(Object.keys(expected.html).length, 12);
  assert.deepEqual(await captureF0(), expected);
});
