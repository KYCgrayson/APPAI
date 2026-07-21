import { db } from "../db.ts";
import { UNIVERSAL_APP_CAPABILITIES, universalAppIdSchema } from "./manifest.ts";
import { retireManagedDatabaseAccess } from "./database-provisioner.ts";

type ActiveDeployment = {
  id: string;
  appReleaseId: string;
  environment: string;
  appRelease: { id: string; appId: string; status: string; app: { appType: string | null } };
  managedRuntime: { id: string; approvedCapabilities?: string[]; reconciledAt?: Date | null } | null;
};

/**
 * Deliberately small transaction surface.  A Prisma transaction can be adapted
 * to this shape, while tests can supply an in-memory command recorder.
 */
export type ManagedRuntimeActivationStore = {
  lockAppActivation(appType: string): Promise<void>;
  appDeployment: {
    findUnique(args: unknown): Promise<ActiveDeployment | null>;
    findFirst(args: unknown): Promise<ActiveDeployment | null>;
    findMany(args: unknown): Promise<Array<{ id: string; appReleaseId: string }>>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  appRelease: { update(args: unknown): Promise<unknown>; updateMany(args: unknown): Promise<{ count: number }> };
  app: { update(args: unknown): Promise<unknown> };
  appManagedRuntime: {
    update(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<Array<{ appDeploymentId: string; databaseProvision: unknown }>>;
  };
  appLaunchCode: { updateMany(args: unknown): Promise<{ count: number }> };
  appRuntimeSession: { updateMany(args: unknown): Promise<{ count: number }> };
  organizationApp: { findMany(args: unknown): Promise<Array<{ id: string }>> };
  appCapabilityGrant: { updateMany(args: unknown): Promise<{ count: number }>; upsert(args: unknown): Promise<unknown> };
  retireDatabaseAccess(appId: string, activeDeploymentId: string, predecessorIds: readonly string[]): Promise<void>;
};

export type ActivateVerifiedManagedRuntimeInput = {
  appId: string;
  releaseId: string;
  deploymentId: string;
  verifiedRuntimeBaseUrl: string;
  healthCheckedAt: Date;
  approvedCapabilities: readonly string[];
  now?: Date;
};

export class ManagedRuntimeActivationError extends Error {}

function normalizedCapabilities(capabilities: readonly string[]) {
  const allowed = new Set<string>(UNIVERSAL_APP_CAPABILITIES);
  const normalized = [...new Set(capabilities)].sort();
  if (!normalized.length || normalized.some((capability) => !allowed.has(capability))) {
    throw new ManagedRuntimeActivationError("Approved capabilities must be a non-empty trusted platform allowlist.");
  }
  return normalized;
}

function verifiedRuntimeUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ManagedRuntimeActivationError("Verified runtime URL must be an absolute HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new ManagedRuntimeActivationError("Verified runtime URL must be credential-free HTTPS.");
  }
  // runtimeBaseUrl is a deployment origin. Entry/callback paths come from the
  // reviewed release contract, so a provider URL cannot smuggle its own path,
  // query, or fragment into later runtime redirects.
  return url.origin;
}

async function reconcileOneOrganizationApp(
  store: Pick<ManagedRuntimeActivationStore, "appCapabilityGrant">,
  organizationAppId: string,
  approvedCapabilities: readonly string[],
) {
  await store.appCapabilityGrant.updateMany({
    where: {
      organizationAppId,
      capability: { notIn: approvedCapabilities },
      status: "ACTIVE",
    },
    data: { status: "SUSPENDED" },
  });
  await Promise.all(approvedCapabilities.map((capability) => store.appCapabilityGrant.upsert({
    where: { organizationAppId_capability: { organizationAppId, capability } },
    create: { organizationAppId, capability, status: "ACTIVE" },
    update: { status: "ACTIVE" },
  })));
}

/**
 * Returns grants from the reconciled active managed runtime only.  It never
 * reads a release manifest, so a newly-created organization instance cannot
 * gain a capability merely because a manifest requested it.
 */
export async function resolveActiveManagedRuntimeCapabilities(
  store: Pick<ManagedRuntimeActivationStore, "appDeployment">,
  appId: string,
) {
  const normalizedAppId = universalAppIdSchema.parse(appId);
  const active = await store.appDeployment.findFirst({
    where: {
      environment: "PRODUCTION",
      status: "ACTIVE",
      appRelease: { status: "APPROVED", app: { appType: normalizedAppId, isApproved: true } },
      managedRuntime: { is: { reconciledAt: { not: null } } },
    },
    include: { appRelease: { include: { app: true } }, managedRuntime: true },
  });
  if (!active || active.environment !== "PRODUCTION" || active.appRelease.status !== "APPROVED" || !active.managedRuntime) {
    return [];
  }
  return normalizedCapabilities(active.managedRuntime.approvedCapabilities ?? []);
}

/** Reconciles a future OrganizationApp from the active runtime allowlist. */
export async function reconcileFutureOrganizationAppCapabilities(
  store: Pick<ManagedRuntimeActivationStore, "appDeployment" | "appCapabilityGrant">,
  input: { appId: string; organizationAppId: string },
) {
  const approvedCapabilities = await resolveActiveManagedRuntimeCapabilities(store, input.appId);
  if (!approvedCapabilities.length) {
    throw new ManagedRuntimeActivationError("No reconciled active managed runtime is available for capability grants.");
  }
  await reconcileOneOrganizationApp(store, input.organizationAppId, approvedCapabilities);
  return approvedCapabilities;
}

/**
 * Atomically cuts production over after provider and health verification have
 * already completed. The per-app transaction lock serializes cutovers so the
 * postcondition is exactly one ACTIVE production deployment.
 */
export async function activateVerifiedManagedRuntime(
  store: ManagedRuntimeActivationStore,
  input: ActivateVerifiedManagedRuntimeInput,
) {
  const appId = universalAppIdSchema.parse(input.appId);
  const approvedCapabilities = normalizedCapabilities(input.approvedCapabilities);
  const runtimeBaseUrl = verifiedRuntimeUrl(input.verifiedRuntimeBaseUrl);
  const now = input.now ?? new Date();
  if (Number.isNaN(input.healthCheckedAt.valueOf())) throw new ManagedRuntimeActivationError("healthCheckedAt must be a valid timestamp.");

  await store.lockAppActivation(appId);
  const current = await store.appDeployment.findUnique({
    where: { id: input.deploymentId },
    include: { appRelease: { include: { app: true } }, managedRuntime: true },
  });
  if (!current || current.environment !== "PRODUCTION" || current.appRelease.id !== input.releaseId ||
      current.appRelease.app.appType !== appId || !current.managedRuntime) {
    throw new ManagedRuntimeActivationError("Deployment is not a managed production deployment for this app/release.");
  }

  const predecessors = await store.appDeployment.findMany({
    where: {
      id: { not: current.id },
      environment: "PRODUCTION",
      status: "ACTIVE",
      appRelease: { appId: current.appRelease.appId },
    },
    select: { id: true, appReleaseId: true },
  });
  const predecessorIds = predecessors.map((deployment) => deployment.id);
  const predecessorReleaseIds = [...new Set(predecessors.map((deployment) => deployment.appReleaseId))];

  if (predecessorIds.length) {
    await store.appDeployment.updateMany({ where: { id: { in: predecessorIds } }, data: { status: "RETIRED" } });
    await store.appRelease.updateMany({ where: { id: { in: predecessorReleaseIds }, status: "APPROVED" }, data: { status: "RETIRED" } });
    await store.appLaunchCode.updateMany({ where: { deploymentId: { in: predecessorIds }, consumedAt: null }, data: { consumedAt: now } });
    await store.appRuntimeSession.updateMany({ where: { deploymentId: { in: predecessorIds }, revokedAt: null }, data: { revokedAt: now } });
  }

  await store.appDeployment.update({
    where: { id: current.id },
    data: { status: "ACTIVE", runtimeBaseUrl, healthCheckedAt: input.healthCheckedAt },
  });
  await store.appRelease.update({ where: { id: current.appRelease.id }, data: { status: "APPROVED" } });
  await store.app.update({ where: { id: current.appRelease.appId }, data: { isApproved: true } });
  await store.appManagedRuntime.update({
    where: { appDeploymentId: current.id },
    data: { publicRuntimeUrl: runtimeBaseUrl, approvedCapabilities, reconciledAt: now },
  });

  const organizationApps = await store.organizationApp.findMany({ where: { appType: appId }, select: { id: true } });
  for (const organizationApp of organizationApps) {
    await reconcileOneOrganizationApp(store, organizationApp.id, approvedCapabilities);
  }

  // This is deliberately last: the replacement has already been health-gated,
  // all activation mutations are still in the same database transaction, and
  // a retirement failure rolls the whole cutover back rather than leaving old
  // credentials usable after a committed replacement activation.
  await store.retireDatabaseAccess(appId, current.id, predecessorIds);

  return { deploymentId: current.id, retiredDeploymentIds: predecessorIds, approvedCapabilities };
}

/**
 * Adapter used by the future deployment reconciler. PostgreSQL advisory locks
 * are transaction-scoped and avoid a cross-table active-deployment race.
 */
export async function activateVerifiedManagedRuntimeInDatabase(input: ActivateVerifiedManagedRuntimeInput) {
  return db.$transaction(async (transaction) => {
    /* eslint-disable @typescript-eslint/no-explicit-any -- Prisma's generated
       delegate signatures are broader than this deliberately minimal
       transaction/test adapter. These casts are isolated at that boundary. */
    const store: ManagedRuntimeActivationStore = {
      lockAppActivation: async (appType) => { await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${appType}))`; },
      appDeployment: transaction.appDeployment as any,
      appRelease: transaction.appRelease as any,
      app: transaction.app as any,
      appManagedRuntime: transaction.appManagedRuntime as any,
      appLaunchCode: transaction.appLaunchCode as any,
      appRuntimeSession: transaction.appRuntimeSession as any,
      organizationApp: transaction.organizationApp as any,
      appCapabilityGrant: transaction.appCapabilityGrant as any,
      retireDatabaseAccess: async (appId, activeDeploymentId, predecessorIds) => {
        const deploymentIds = [activeDeploymentId, ...predecessorIds];
        const predecessors = await transaction.appManagedRuntime.findMany({
          where: { appDeploymentId: { in: deploymentIds } },
          select: { appDeploymentId: true, databaseProvision: true },
        });
        if (predecessors.length !== deploymentIds.length) {
          throw new ManagedRuntimeActivationError("A deployment is missing managed runtime metadata; refusing an unsafe cutover.");
        }
        const byDeploymentId = new Map(predecessors.map((runtime) => [runtime.appDeploymentId, runtime]));
        const active = byDeploymentId.get(activeDeploymentId);
        if (!active) throw new ManagedRuntimeActivationError("The active deployment is missing managed runtime metadata.");
        await retireManagedDatabaseAccess({
          appId,
          activeDeployment: { deploymentId: active.appDeploymentId, databaseProvision: active.databaseProvision },
          predecessorDeployments: predecessorIds.map((deploymentId) => {
            const predecessor = byDeploymentId.get(deploymentId);
            if (!predecessor) throw new ManagedRuntimeActivationError("A predecessor is missing managed runtime metadata; refusing an unsafe cutover.");
            return { deploymentId: predecessor.appDeploymentId, databaseProvision: predecessor.databaseProvision };
          }),
        }, {
          // SQL comes exclusively from databaseRetirementSql after generated
          // identifier validation; no manifest or metadata text is interpolated.
          execute: async (sql) => { await transaction.$executeRawUnsafe(sql); },
        });
      },
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return activateVerifiedManagedRuntime(store, input);
  });
}
