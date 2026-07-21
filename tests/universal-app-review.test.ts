import assert from "node:assert/strict";
import test from "node:test";

import {
  canStartManagedProductionDeployment,
  getReleaseReviewState,
  getSafeRepositoryUrl,
} from "../src/lib/universal-apps/review.ts";

test("review state waits for platform build instead of implying approval", () => {
  assert.deepEqual(getReleaseReviewState({ releaseStatus: "PENDING", deploymentStatuses: [] }), {
    label: "Awaiting platform build / provisioning",
    tone: "warning",
  });
});

test("review state identifies active and failed platform deployments", () => {
  assert.equal(getReleaseReviewState({ releaseStatus: "APPROVED", deploymentStatuses: ["ACTIVE"] }).tone, "success");
  assert.equal(getReleaseReviewState({ releaseStatus: "APPROVED", deploymentStatuses: ["FAILED"] }).tone, "danger");
});

test("repository review links allow only credential-free HTTPS URLs", () => {
  assert.equal(getSafeRepositoryUrl("https://github.com/example/inventory"), "https://github.com/example/inventory");
  for (const unsafeUrl of ["javascript:alert(1)", "http://github.com/example/inventory", "https://user:pass@github.com/example/inventory"]) {
    assert.equal(getSafeRepositoryUrl(unsafeUrl), null, unsafeUrl);
  }
});

test("managed deployment action mirrors the trusted production retry gate", () => {
  assert.equal(canStartManagedProductionDeployment({ releaseStatus: "PENDING", deployments: [] }), true);
  assert.equal(canStartManagedProductionDeployment({
    releaseStatus: "PENDING",
    deployments: [{ environment: "PRODUCTION", status: "FAILED" }],
  }), true);
  assert.equal(canStartManagedProductionDeployment({
    releaseStatus: "PENDING",
    deployments: [{ environment: "PRODUCTION", status: "PROVISIONING" }],
  }), false);
  assert.equal(canStartManagedProductionDeployment({
    releaseStatus: "PENDING",
    deployments: [{ environment: "PRODUCTION", status: "ACTIVE" }],
  }), false);
  assert.equal(canStartManagedProductionDeployment({
    releaseStatus: "APPROVED",
    deployments: [{ environment: "PRODUCTION", status: "FAILED" }],
  }), false);
  assert.equal(canStartManagedProductionDeployment({
    releaseStatus: "RETIRED",
    deployments: [{ environment: "PREVIEW", status: "FAILED" }],
  }), false);
});
