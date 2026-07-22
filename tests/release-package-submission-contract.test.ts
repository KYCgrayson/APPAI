import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("a package submission records source integrity separately from platform build evidence", () => {
  const route = read("src/app/api/v1/apps/[id]/releases/route.ts");

  assert.match(route, /sourceDigest:\s*packageVerification!\.digest/);
  assert.match(route, /artifactDigest:\s*null/);
  assert.doesNotMatch(route, /artifactDigest:\s*packageVerification\?\.digest/);
});

test("upload intent reports only the known private-storage configuration outage as 503", () => {
  const route = read("src/app/api/v1/apps/[id]/release-packages/route.ts");

  assert.match(route, /isReleasePackagePrivateStorageNotConfiguredError\(error\)/);
  assert.match(route, /PRIVATE_STORAGE_NOT_CONFIGURED[\s\S]{0,80}status:\s*503/);
  assert.match(route, /INTERNAL_ERROR[\s\S]{0,80}status:\s*500/);
  assert.match(route, /data:\s*\{\s*status:\s*"EXPIRED"\s*\}/);
  assert.doesNotMatch(route, /console\.error\([^\n]*,\s*error\)/);
});
