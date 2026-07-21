import assert from "node:assert/strict";
import test from "node:test";

import { safeInternalPath } from "../src/lib/redirects.ts";
import { getUniversalAppLaunchPath } from "../src/lib/universal-apps/directory.ts";

test("logout callback stays internal", () => {
  assert.equal(safeInternalPath("/apps?category=COMMERCE", "/"), "/apps?category=COMMERCE");
  assert.equal(safeInternalPath("https://attacker.example", "/"), "/");
  assert.equal(safeInternalPath("//attacker.example", "/"), "/");
});

test("directory launch CTA is generic and requires an approved validated app type", () => {
  assert.equal(getUniversalAppLaunchPath({ isApproved: true, appType: "inventory" }), "/app/inventory");
  assert.equal(getUniversalAppLaunchPath({ isApproved: false, appType: "inventory" }), null);
  assert.equal(getUniversalAppLaunchPath({ isApproved: true, appType: "../inventory" }), null);
});
