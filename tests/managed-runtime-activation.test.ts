import assert from "node:assert/strict";
import test from "node:test";

import {
  activateVerifiedManagedRuntime,
  reconcileFutureOrganizationAppCapabilities,
  resolveActiveManagedRuntimeCapabilities,
  type ManagedRuntimeActivationStore,
} from "../src/lib/universal-apps/activation.ts";

function makeStore() {
  // This recorder intentionally accepts all Prisma-style argument objects.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: Array<{ model: string; args: any }> = [];
  const current = {
    id: "deploy-current",
    appReleaseId: "release-current",
    environment: "PRODUCTION",
    appRelease: { id: "release-current", appId: "app-record", status: "PENDING", app: { appType: "simpleshop" } },
    managedRuntime: { id: "runtime-current" },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resolverDeployment: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mutation = (model: string) => async (args: any) => { calls.push({ model, args }); return { count: 1 }; };
  const store: ManagedRuntimeActivationStore = {
    lockAppActivation: async (appType) => { calls.push({ model: "lock", args: appType }); },
    appDeployment: {
      findUnique: async () => current,
      findFirst: async () => resolverDeployment,
      findMany: async () => [{ id: "deploy-old", appReleaseId: "release-old" }],
      update: mutation("deployment.update"),
      updateMany: mutation("deployment.updateMany"),
    },
    appRelease: { update: mutation("release.update"), updateMany: mutation("release.updateMany") },
    app: { update: mutation("app.update") },
    appManagedRuntime: { update: mutation("runtime.update"), findMany: async () => [] },
    appLaunchCode: { updateMany: mutation("launch.updateMany") },
    appRuntimeSession: { updateMany: mutation("session.updateMany") },
    organizationApp: { findMany: async () => [{ id: "org-app-a" }, { id: "org-app-b" }] },
    appCapabilityGrant: { updateMany: mutation("grant.updateMany"), upsert: mutation("grant.upsert") },
    retireDatabaseAccess: async (appId, activeDeploymentId, predecessorIds) => { calls.push({ model: "database.retire", args: { appId, activeDeploymentId, predecessorIds } }); },
  };
  return {
    store,
    calls,
    // The test double deliberately permits the partial shape needed per test.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setResolver: (value: any) => { resolverDeployment = value; },
  };
}

test("verified activation retires predecessors, revokes access, and reconciles trusted grants", async () => {
  const { store, calls } = makeStore();
  const at = new Date("2026-07-22T08:00:00.000Z");
  const result = await activateVerifiedManagedRuntime(store, {
    appId: "simpleshop",
    releaseId: "release-current",
    deploymentId: "deploy-current",
    verifiedRuntimeBaseUrl: "https://simpleshop.example/runtime?untrusted=1#fragment",
    healthCheckedAt: at,
    approvedCapabilities: ["database", "identity"],
    now: at,
  });

  assert.deepEqual(result, {
    deploymentId: "deploy-current",
    retiredDeploymentIds: ["deploy-old"],
    approvedCapabilities: ["database", "identity"],
  });
  assert.deepEqual(calls[0], { model: "lock", args: "simpleshop" });
  assert.ok(calls.some(({ model, args }) => model === "deployment.updateMany" && args.data.status === "RETIRED"));
  assert.ok(calls.some(({ model, args }) => model === "release.updateMany" && args.data.status === "RETIRED"));
  assert.ok(calls.some(({ model, args }) => model === "launch.updateMany" && args.data.consumedAt === at));
  assert.ok(calls.some(({ model, args }) => model === "session.updateMany" && args.data.revokedAt === at));
  assert.ok(calls.some(({ model, args }) => model === "deployment.update" && args.data.status === "ACTIVE" && args.data.healthCheckedAt === at));
  assert.ok(calls.some(({ model, args }) => model === "runtime.update" && args.data.approvedCapabilities.join(",") === "database,identity" && args.data.publicRuntimeUrl === "https://simpleshop.example"));
  assert.equal(calls.filter(({ model, args }) => model === "grant.updateMany" && args.data.status === "SUSPENDED").length, 2);
  assert.equal(calls.filter(({ model, args }) => model === "grant.upsert" && args.update.status === "ACTIVE").length, 4);
  const activeMutation = calls.findIndex(({ model, args }) => model === "deployment.update" && args.data.status === "ACTIVE");
  const retiredCredentials = calls.findIndex(({ model }) => model === "database.retire");
  assert.ok(retiredCredentials > activeMutation);
  assert.deepEqual(calls[retiredCredentials], { model: "database.retire", args: { appId: "simpleshop", activeDeploymentId: "deploy-current", predecessorIds: ["deploy-old"] } });
});

test("future organization-app grants are derived only from reconciled active runtime state", async () => {
  const { store, calls, setResolver } = makeStore();
  setResolver({
    id: "deploy-current",
    environment: "PRODUCTION",
    appRelease: { id: "release-current", appId: "app-record", status: "APPROVED", app: { appType: "simpleshop" } },
    managedRuntime: { id: "runtime-current", reconciledAt: new Date(), approvedCapabilities: ["identity"] },
  });
  assert.deepEqual(await resolveActiveManagedRuntimeCapabilities(store, "simpleshop"), ["identity"]);
  await reconcileFutureOrganizationAppCapabilities(store, { appId: "simpleshop", organizationAppId: "new-org-app" });
  assert.equal(calls.filter(({ model }) => model === "grant.upsert").length, 1);
  assert.equal(calls.find(({ model }) => model === "grant.upsert")?.args.create.capability, "identity");
});

test("activation rejects a non-HTTPS runtime before mutating state", async () => {
  const { store, calls } = makeStore();
  await assert.rejects(() => activateVerifiedManagedRuntime(store, {
    appId: "simpleshop", releaseId: "release-current", deploymentId: "deploy-current",
    verifiedRuntimeBaseUrl: "http://unsafe.example", healthCheckedAt: new Date(), approvedCapabilities: ["identity"],
  }));
  assert.equal(calls.length, 0);
});

test("no predecessor credentials are retired before health-gated activation is called", async () => {
  const { store, calls } = makeStore();
  // The activation function is the cutover boundary; an upstream failed health
  // check never calls it, so this store records no database retirement.
  assert.equal(calls.some(({ model }) => model === "database.retire"), false);
  await assert.rejects(() => activateVerifiedManagedRuntime(store, {
    appId: "simpleshop", releaseId: "release-current", deploymentId: "deploy-current",
    verifiedRuntimeBaseUrl: "http://failed-health.example", healthCheckedAt: new Date(), approvedCapabilities: ["identity"],
  }));
  assert.equal(calls.some(({ model }) => model === "database.retire"), false);
});
