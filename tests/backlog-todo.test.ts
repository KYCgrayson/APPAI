import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("backlog 32 contains plain tasks and the remaining production follow-up", () => {
  const backlog = readFileSync(new URL("../TODO.md", import.meta.url), "utf8").split("### Backlog #32")[1].trim().split("\n").slice(1).filter(Boolean);
  assert.ok(backlog.every(line => /^- \[[ x]\] /.test(line)));
  assert.deepEqual(backlog.filter(line => line.startsWith("- [ ]")), [
    "- [ ] Confirm production cause of the hosted-page 500 from logs.",
  ]);
  assert.doesNotMatch(backlog.join("\n"), /postgresql|sandbox|session|127\.0\.0\.1/i);
});
