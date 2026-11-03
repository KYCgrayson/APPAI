import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { serializeJsonLd } from "../src/lib/json-ld.ts";

const cases = [
  ["script injection", { title: "</script><script>alert(1)</script>" }],
  ["HTML comment", { text: "<!--" }],
  ["ampersand", { text: "&" }],
  ["Unicode separators", { text: "before\u2028middle\u2029after" }],
  ["nested objects and arrays", { nested: [{ text: "<>&\u2028\u2029" }, [null, true, 42]] }],
] as const;

for (const [name, input] of cases) {
  test(`serializeJsonLd safely round-trips ${name}`, () => {
    const output = serializeJsonLd(input);
    assert.doesNotMatch(output, /[<>&\u2028\u2029]/);
    assert.deepEqual(JSON.parse(output), input);
  });
}

test("JSON-LD sites do not stringify directly in dangerouslySetInnerHTML", () => {
  const root = new URL("../src/", import.meta.url);
  let sites = 0;
  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (!/\.[jt]sx?$/.test(file)) continue;
    const source = readFileSync(new URL(file, root), "utf8");
    if (!source.includes("application/ld+json")) continue;
    sites++;
    for (const [expression] of source.matchAll(/dangerouslySetInnerHTML\s*=\s*\{\{[\s\S]*?\}\}/g)) {
      assert.doesNotMatch(expression, /JSON\.stringify\s*\(/, join("src", file));
    }
  }
  assert.ok(sites > 0, "expected JSON-LD source files");
});
