import assert from "node:assert/strict";
import test from "node:test";

import {
  mayUseSimpleshopCompatibilityRuntime,
  selectUniversalRuntimeTarget,
} from "../src/lib/universal-apps/cutover.ts";

test("Simpleshop falls back only when no approved active production deployment exists", () => {
  assert.equal(mayUseSimpleshopCompatibilityRuntime("APP_UNAVAILABLE"), true);
});

test("Simpleshop does not bypass suspended or invalid Universal runtime state", () => {
  for (const code of ["APP_SUSPENDED", "INVALID_RELEASE", "INVALID_DEPLOYMENT", "INVALID_LAUNCH_CODE"]) {
    assert.equal(mayUseSimpleshopCompatibilityRuntime(code), false, code);
  }
});

type Deployment = { id: string; environment: string; status: string };
type Release = { id: string; status: string; deployments: Deployment[] };

function target(releases: Release[], appIsApproved = true) {
  return selectUniversalRuntimeTarget(releases, appIsApproved);
}

test("an app with no release or no production deployment remains eligible for compatibility", () => {
  assert.equal(target([]).kind, "APP_UNAVAILABLE");
  assert.equal(target([{ id: "approved", status: "APPROVED", deployments: [] }]).kind, "APP_UNAVAILABLE");
  assert.equal(target([{
    id: "approved-preview-only",
    status: "APPROVED",
    deployments: [{ id: "preview", environment: "PREVIEW", status: "ACTIVE" }],
  }]).kind, "APP_UNAVAILABLE");
});

test("an existing unapproved app fails closed even before it has a release", () => {
  assert.equal(target([], false).kind, "INVALID_RELEASE");
  assert.equal(target([], true).kind, "APP_UNAVAILABLE");
});

test("a non-approved release fails closed instead of looking unprovisioned", () => {
  assert.equal(target([{ id: "rejected", status: "REJECTED", deployments: [] }]).kind, "INVALID_RELEASE");
});

test("a non-active production deployment fails closed instead of looking unprovisioned", () => {
  assert.equal(target([{
    id: "approved",
    status: "APPROVED",
    deployments: [{ id: "failed", environment: "PRODUCTION", status: "FAILED" }],
  }]).kind, "INVALID_DEPLOYMENT");
});

test("a valid approved active production target wins over invalid records", () => {
  const resolved = target([
    { id: "rejected", status: "REJECTED", deployments: [] },
    {
      id: "approved",
      status: "APPROVED",
      deployments: [{ id: "active", environment: "PRODUCTION", status: "ACTIVE" }],
    },
  ]);
  assert.equal(resolved.kind, "LAUNCH");
  if (resolved.kind === "LAUNCH") {
    assert.equal(resolved.release.id, "approved");
    assert.equal(resolved.deployment.id, "active");
  }
});
