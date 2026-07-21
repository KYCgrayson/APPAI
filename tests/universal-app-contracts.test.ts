import assert from "node:assert/strict";
import test from "node:test";

import {
  approveUniversalAppDeploymentSchema,
  publishUniversalAppReleaseSchema,
  universalAppManifestSchema,
} from "../src/lib/universal-apps/manifest.ts";
import {
  canReadUniversalApp,
  mapUniversalAppReleaseStatus,
} from "../src/lib/universal-apps/release-status.ts";

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

test("agent release repository URL must be credential-free HTTPS", () => {
  const release = {
    manifest,
    tagline: "庫存管理",
    description: "獨立執行的資料庫型 app",
  };
  assert.equal(publishUniversalAppReleaseSchema.safeParse({ ...release, repoUrl: "https://github.com/example/inventory" }).success, true);
  for (const repoUrl of ["http://github.com/example/inventory", "javascript:alert(1)", "https://user:pass@github.com/example/inventory"]) {
    assert.equal(publishUniversalAppReleaseSchema.safeParse({ ...release, repoUrl }).success, false, repoUrl);
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

test("owner release status is generic for a second database app and redacts operational values", () => {
  const createdAt = new Date("2026-07-21T00:00:00.000Z");
  const mapped = mapUniversalAppReleaseStatus({
    id: "release_inventory", version: "1.2.3", status: "APPROVED", sourceRevision: "1234567",
    artifactDigest: `sha256:${"b".repeat(64)}`, createdAt, updatedAt: createdAt,
    deployments: [
      { environment: "PRODUCTION", status: "ACTIVE", runtimeBaseUrl: "https://inventory.example.test/internal?token=secret", healthCheckedAt: createdAt, createdAt, updatedAt: createdAt },
      { environment: "PREVIEW", status: "FAILED", runtimeBaseUrl: "https://preview.example.test/private", healthCheckedAt: null, createdAt, updatedAt: createdAt },
    ],
  });
  assert.equal(mapped.releaseId, "release_inventory");
  assert.equal(mapped.artifactDigest, `sha256:${"b".repeat(64)}`);
  assert.equal("runtimePublicOrigin" in mapped.deployments[0], false);
  assert.equal(JSON.stringify(mapped).includes("token=secret"), false);
  assert.equal(JSON.stringify(mapped).includes("inventory.example.test"), false);
  assert.equal(JSON.stringify(mapped).includes("/private"), false);
});

test("only the owning organization can read an app release status", () => {
  assert.equal(canReadUniversalApp("org-inventory", "org-inventory"), true);
  assert.equal(canReadUniversalApp("org-other", "org-inventory"), false);
});
