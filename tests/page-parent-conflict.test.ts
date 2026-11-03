import test from "node:test";
import assert from "node:assert/strict";
import { pageParentConflict } from "../src/lib/page-parent-conflict.ts";

test("matching parents allow upsert, including omitted and null roots", () => {
  for (const requested of [undefined, null, "parent"]) {
    for (const existing of [undefined, null, "parent"]) {
      if ((requested ?? null) === (existing ?? null)) {
        assert.equal(pageParentConflict("page", "en", requested, existing), null);
      }
    }
  }
});

test("child to root and child to another parent report the existing child location", () => {
  for (const requested of [undefined, null, "other-parent"]) {
    assert.deepEqual(pageParentConflict("page", "en", requested, "parent"), {
      error: 'Page "page" (locale "en") already exists as a child of "parent"',
      hint: "Reparenting is not supported. Use the existing parent, or DELETE /api/v1/pages/page?locale=en first, or choose a different slug.",
    });
  }
});

test("root to child reports the existing root location and requested locale", () => {
  for (const existing of [undefined, null]) {
    assert.deepEqual(pageParentConflict("page", "ja", "parent", existing), {
      error: 'Page "page" (locale "ja") already exists as a root page',
      hint: "Reparenting is not supported. Use the existing parent, or DELETE /api/v1/pages/page?locale=ja first, or choose a different slug.",
    });
  }
});
