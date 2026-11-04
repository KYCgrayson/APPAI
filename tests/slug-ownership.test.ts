import test from "node:test";
import assert from "node:assert/strict";
import { slugOwnershipDecision } from "../src/lib/slug-ownership.ts";

test("new slug is available", () => {
  assert.equal(slugOwnershipDecision([], "org-a").status, 200);
});
test("same organization can add a locale", () => {
  assert.equal(slugOwnershipDecision([{ organizationId: "org-a" }], "org-a").status, 200);
});
// Ownership depends on all existing root variants, never the requested locale.
const roots = [{ organizationId: "org-a", locale: "en" }];
for (const locale of ["en", "zh-TW"]) {
  test(`another organization is forbidden for ${locale === "en" ? "same" : "new"} locale`, () => {
    assert.deepEqual(slugOwnershipDecision(roots, "org-b"), {
      status: 403, error: "Slug belongs to another organization",
    });
  });
}

test("any foreign root forbids publication, including mixed legacy ownership", () => {
  assert.equal(slugOwnershipDecision([
    { organizationId: "org-a" }, { organizationId: "org-b" },
  ], "org-a").status, 403);
});

test("child creation is not subject to root slug ownership", () => {
  assert.equal(slugOwnershipDecision(roots, "org-b", "other-site").status, 200);
});
