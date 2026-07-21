import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  approveUniversalAppDeploymentSchema,
  publishUniversalAppReleaseSchema,
  universalAppIdSchema,
  universalAppManifestSchema,
} from "../src/lib/universal-apps/manifest.ts";
import {
  canReadUniversalApp,
  mapUniversalAppReleaseStatus,
} from "../src/lib/universal-apps/release-status.ts";
import {
  canRevokeUniversalAppSession,
  runtimeSessionMatchesApp,
  runtimeUserBelongsToOrganization,
  sanitizeUniversalRuntimeIdentity,
  universalAppUserRevocationScope,
} from "../src/lib/universal-apps/runtime-session-contract.ts";

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

test("Universal App ids cannot claim AppAI platform subdomains", () => {
  for (const id of ["www", "api", "admin", "auth", "login", "dashboard", "mail"]) {
    assert.equal(universalAppIdSchema.safeParse(id).success, false, id);
  }
});

test("Universal App ids are valid DNS labels for managed subdomains", () => {
  assert.equal(universalAppIdSchema.safeParse("ab").success, true);
  assert.equal(universalAppIdSchema.safeParse(`a${"b".repeat(61)}c`).success, true);
  for (const id of ["a-", `a${"b".repeat(63)}`]) assert.equal(universalAppIdSchema.safeParse(id).success, false, id);
});

test("agent release input cannot select deployment URLs, secrets or SQL", () => {
  const release = {
    manifest,
    tagline: "店務管理",
    description: "獨立執行的店務管理 app",
    repoUrl: "https://github.com/example/simpleshop",
    sourceRevision: "a".repeat(40),
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
    sourceRevision: "a".repeat(40),
  };
  assert.equal(publishUniversalAppReleaseSchema.safeParse({ ...release, repoUrl: "https://github.com/example/inventory" }).success, true);
  for (const repoUrl of ["http://github.com/example/inventory", "javascript:alert(1)", "https://user:pass@github.com/example/inventory", "https://localhost/example/inventory", "https://127.0.0.1/example/inventory", "https://example.com/example/inventory"]) {
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
      { environment: "PRODUCTION", status: "ACTIVE", healthCheckedAt: createdAt, createdAt, updatedAt: createdAt, managedRuntime: { failureCode: "UNEXPOSED", failureMessage: "not a failed deployment" } },
      { environment: "PREVIEW", status: "FAILED", healthCheckedAt: null, createdAt, updatedAt: createdAt, managedRuntime: { failureCode: "HEALTH_CHECK_FAILED", failureMessage: "Health check did not return the managed contract." } },
    ],
  });
  assert.equal(mapped.releaseId, "release_inventory");
  assert.equal(mapped.artifactDigest, `sha256:${"b".repeat(64)}`);
  assert.equal("failure" in mapped.deployments[0], false);
  assert.deepEqual(mapped.deployments[1].failure, {
    code: "HEALTH_CHECK_FAILED",
    message: "Health check did not return the managed contract.",
  });
  assert.equal(JSON.stringify(mapped).includes("runtimeBaseUrl"), false);
  assert.equal(JSON.stringify(mapped).includes("publicRuntimeUrl"), false);
  assert.equal(JSON.stringify(mapped).includes("providerProjectId"), false);
  assert.equal(JSON.stringify(mapped).includes("databaseProvision"), false);
});

test("failed deployment status keeps the failure object even when no worker evidence was recorded", () => {
  const createdAt = new Date("2026-07-21T00:00:00.000Z");
  const mapped = mapUniversalAppReleaseStatus({
    id: "release_failed", version: "1.2.3", status: "PENDING", sourceRevision: null,
    artifactDigest: null, createdAt, updatedAt: createdAt,
    deployments: [{
      environment: "PRODUCTION", status: "FAILED", healthCheckedAt: null, createdAt, updatedAt: createdAt,
      managedRuntime: null,
    }],
  });
  assert.deepEqual(mapped.deployments[0].failure, { code: null, message: null });
});

test("only the owning organization can read an app release status", () => {
  assert.equal(canReadUniversalApp("org-inventory", "org-inventory"), true);
  assert.equal(canReadUniversalApp("org-other", "org-inventory"), false);
});

test("runtime identity exposes display values only with the identity capability", () => {
  const input = {
    user: { id: "user_1", name: "Ada", email: "ada@example.test" },
    organization: { id: "org_1", name: "Inventory Co" },
  };
  assert.deepEqual(sanitizeUniversalRuntimeIdentity({ ...input, capabilities: ["database", "identity"] }), {
    user: input.user, organization: input.organization,
  });
  assert.deepEqual(sanitizeUniversalRuntimeIdentity({ ...input, capabilities: ["database"] }), {
    user: { id: "user_1", name: null, email: null }, organization: input.organization,
  });
});

test("runtime session validity denies cross-app and revoked sessions", () => {
  const now = new Date("2026-07-21T00:00:00.000Z");
  const active = {
    revokedAt: null, expiresAt: new Date("2026-07-21T01:00:00.000Z"), organizationAppStatus: "ACTIVE",
    deploymentStatus: "ACTIVE", releaseStatus: "APPROVED", deployedAppId: "inventory-db",
  };
  assert.equal(runtimeSessionMatchesApp(active, "inventory-db", now), true);
  assert.equal(runtimeSessionMatchesApp(active, "simpleshop", now), false);
  assert.equal(runtimeSessionMatchesApp({ ...active, revokedAt: now }, "inventory-db", now), false);
  assert.equal(runtimeUserBelongsToOrganization("org_inventory", "org_inventory"), true);
  assert.equal(runtimeUserBelongsToOrganization("org_other", "org_inventory"), false);
  assert.equal(canRevokeUniversalAppSession("inventory-db", "inventory-db"), true);
  assert.equal(canRevokeUniversalAppSession("inventory-db", "simpleshop"), false);
  // A second revoke is still a successful, secret-free outcome for the same app.
  assert.equal(canRevokeUniversalAppSession("inventory-db", "inventory-db"), true);
});

test("platform logout revocation scopes only to the specified user's open sessions", () => {
  assert.deepEqual(universalAppUserRevocationScope("user_inventory"), {
    userId: "user_inventory",
    revokedAt: null,
  });
  assert.notDeepEqual(universalAppUserRevocationScope("user_other"), universalAppUserRevocationScope("user_inventory"));
});

test("release API shares the apps dynamic segment name", () => {
  assert.equal(existsSync(new URL("../src/app/api/v1/apps/[id]/releases/route.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../src/app/api/v1/apps/[appId]", import.meta.url)), false);
});
