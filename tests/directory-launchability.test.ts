import assert from "node:assert/strict";
import test from "node:test";

import { canLaunchUniversalApp } from "../src/lib/universal-apps/directory.ts";

const app = { isApproved: true, appType: "runtime-contract-test" };
const active = [{ status: "APPROVED", deployments: [{ environment: "PRODUCTION", status: "ACTIVE" }] }];

test("an approved app with an active production deployment is launchable", () => {
  assert.equal(canLaunchUniversalApp(app, active), true);
});

test("approval alone is not launchable — the Runtime Contract Test case", () => {
  // Registered and approved, but no release was ever built or deployed. This is
  // what used to show a UNIVERSAL APP badge linking to an error page.
  assert.equal(canLaunchUniversalApp(app, []), false);
  assert.equal(canLaunchUniversalApp(app, undefined), false);
});

test("a pending or rejected release is not launchable", () => {
  assert.equal(
    canLaunchUniversalApp(app, [
      { status: "PENDING", deployments: [{ environment: "PRODUCTION", status: "ACTIVE" }] },
    ]),
    false,
  );
  assert.equal(
    canLaunchUniversalApp(app, [
      { status: "REJECTED", deployments: [{ environment: "PRODUCTION", status: "ACTIVE" }] },
    ]),
    false,
  );
});

test("a provisioning or failed deployment is not launchable", () => {
  for (const status of ["PROVISIONING", "FAILED", "RETIRED"]) {
    assert.equal(
      canLaunchUniversalApp(app, [{ status: "APPROVED", deployments: [{ environment: "PRODUCTION", status }] }]),
      false,
      `${status} must not be launchable`,
    );
  }
});

test("a newer rejected release does not take down a still-active approved one", () => {
  // Mirrors selectUniversalRuntimeTarget's ordering contract: newest first.
  const releases = [
    { status: "REJECTED", deployments: [] },
    { status: "APPROVED", deployments: [{ environment: "PRODUCTION", status: "ACTIVE" }] },
  ];
  assert.equal(canLaunchUniversalApp(app, releases), true);
});

test("an unapproved app or a malformed appType is never launchable", () => {
  assert.equal(canLaunchUniversalApp({ isApproved: false, appType: "inventory" }, active), false);
  assert.equal(canLaunchUniversalApp({ isApproved: true, appType: "../inventory" }, active), false);
  assert.equal(canLaunchUniversalApp({ isApproved: true, appType: null }, active), false);
});
