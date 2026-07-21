import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import test from "node:test";

import {
  getUniversalAppNestedReturnPath,
  mapPlatformRouteToRuntimePath,
} from "../src/lib/universal-apps/launcher-path.ts";

test("generic nested launcher preserves a safe encoded relative return path", () => {
  assert.equal(
    getUniversalAppNestedReturnPath("simpleshop", ["items", "new order?draft=1"]),
    "/app/simpleshop/items/new%20order%3Fdraft%3D1",
  );
  assert.throws(() => getUniversalAppNestedReturnPath("https://evil.example", ["items"]));
});

test("generic launcher maps the platform base route to a runtime entry path", () => {
  assert.equal(mapPlatformRouteToRuntimePath("inventory", "/app/inventory", "/"), "/");
  assert.equal(mapPlatformRouteToRuntimePath("inventory", "/app/inventory", "/inventory"), "/inventory");
  assert.equal(mapPlatformRouteToRuntimePath("simpleshop", "/app/simpleshop", "/app/simpleshop"), "/app/simpleshop");
});

test("generic launcher appends an encoded platform suffix inside the runtime entry path", () => {
  assert.equal(
    mapPlatformRouteToRuntimePath("inventory", "/app/inventory/items/new%20order%3Fdraft%3D1", "/inventory/"),
    "/inventory/items/new%20order%3Fdraft%3D1",
  );
  assert.equal(
    mapPlatformRouteToRuntimePath("simpleshop", "/app/simpleshop/items?filter=low#today", "/app/simpleshop"),
    "/app/simpleshop/items?filter=low#today",
  );
});

test("generic launcher falls back to the manifest entry path for malformed or cross-app routes", () => {
  for (const platformPath of ["https://evil.example", "//evil.example", "/app/other/items", "/app/inventory%2Fevil"]) {
    assert.equal(mapPlatformRouteToRuntimePath("inventory", platformPath, "/inventory"), "/inventory", platformPath);
  }
});

test("AppAI no longer contains a Simpleshop compatibility UI or API route", () => {
  for (const path of [
    "src/app/app/simpleshop",
    "src/app/api/apps/simpleshop",
    "src/components/apps/simpleshop",
    "src/lib/simpleshop",
  ]) {
    const location = new URL(`../${path}`, import.meta.url);
    const files = existsSync(location)
      ? readdirSync(location, { recursive: true }).filter((entry) => typeof entry === "string" && /\.[cm]?[jt]sx?$/.test(entry))
      : [];
    assert.deepEqual(files, [], path);
  }
});
