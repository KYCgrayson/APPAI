import assert from "node:assert/strict";
import test from "node:test";

import {
  approveUniversalAppDeploymentSchema,
  publishUniversalAppReleaseSchema,
  universalAppManifestSchema,
} from "../src/lib/universal-apps/manifest.ts";

const manifest = {
  schemaVersion: 1,
  id: "simpleshop",
  name: "Simpleshop",
  version: "0.1.0",
  runtime: {
    type: "node",
    buildCommand: "npm run build",
    startCommand: "npm run start",
    healthPath: "/api/health",
  },
  entryPath: "/app/simpleshop",
  callbackPath: "/api/appai/callback",
  capabilities: ["identity", "database", "private-assets"],
};

test("Universal App manifest accepts Simpleshop without business-specific fields", () => {
  const parsed = universalAppManifestSchema.parse(manifest);
  assert.equal(parsed.id, "simpleshop");
  assert.deepEqual(parsed.capabilities, ["identity", "database", "private-assets"]);
});

test("agent release input cannot select deployment URLs, secrets or SQL", () => {
  const release = {
    manifest,
    tagline: "店務管理",
    description: "獨立執行的店務管理 app",
  };
  assert.equal(publishUniversalAppReleaseSchema.safeParse(release).success, true);
  for (const field of ["runtimeBaseUrl", "databaseUrl", "secret", "sql"]) {
    assert.equal(publishUniversalAppReleaseSchema.safeParse({ ...release, [field]: "forged" }).success, false, field);
  }
});

test("only the platform approval input can bind an artifact to a deployment", () => {
  const parsed = approveUniversalAppDeploymentSchema.parse({
    runtimeBaseUrl: "https://runtime.example.test",
    artifactDigest: `sha256:${"a".repeat(64)}`,
  });
  assert.equal(parsed.environment, "PRODUCTION");
  assert.equal(approveUniversalAppDeploymentSchema.safeParse({
    runtimeBaseUrl: "https://runtime.example.test",
    artifactDigest: "latest",
  }).success, false);
});
