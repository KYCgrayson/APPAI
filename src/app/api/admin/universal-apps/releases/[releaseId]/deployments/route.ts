import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { requireSameOrigin } from "@/lib/request-security";
import { activateVerifiedManagedRuntimeInDatabase } from "@/lib/universal-apps/activation";
import { provisionAppDatabaseFromEnvironment } from "@/lib/universal-apps/database-provisioner";
import { checkManagedRuntimeHealthWithRetry } from "@/lib/universal-apps/managed-health";
import { orchestrateManagedDeployment } from "@/lib/universal-apps/managed-orchestrator";
import { universalAppManifestSchema } from "@/lib/universal-apps/manifest";
import {
  deployValidatedRelease,
  validateRelease,
} from "@/lib/universal-apps/vercel-sandbox-provider";
import {
  createVercelSandboxFactory,
  runIsolatedMigration,
} from "@/lib/universal-apps/vercel-sandbox-worker";
import { getVercelOidcToken } from "@/lib/universal-apps/vercel-oidc";

export const maxDuration = 800;

type RouteContext = { params: Promise<{ releaseId: string }> };

type PreparedDeployment = {
  id: string;
  appId: string;
  version: string;
  repoUrl: string;
  sourceRevision: string;
  manifest: ReturnType<typeof universalAppManifestSchema.parse>;
};

async function prepareDeployment(releaseId: string): Promise<PreparedDeployment | { error: string; status: number }> {
  return db.$transaction(async (transaction) => {
    const release = await transaction.appRelease.findUnique({
      where: { id: releaseId },
      include: { app: true, deployments: { where: { environment: "PRODUCTION" }, select: { id: true, status: true } } },
    });
    if (!release) return { error: "RELEASE_NOT_FOUND", status: 404 };
    if (!release.app.appType || release.status !== "PENDING") return { error: "RELEASE_NOT_DEPLOYABLE", status: 409 };
    const manifest = universalAppManifestSchema.safeParse(release.manifest);
    if (!manifest.success || manifest.data.id !== release.app.appType) return { error: "INVALID_RELEASE_MANIFEST", status: 409 };
    if (!release.sourceRepoUrl || !release.sourceRevision) return { error: "RELEASE_SOURCE_REQUIRED", status: 409 };

    // Serialize production transitions per app. The deployment is marked
    // PROVISIONING in this same transaction, which blocks a second worker once
    // the advisory lock is released.
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${release.app.appType}))`;
    const lockedRelease = await transaction.appRelease.findUnique({
      where: { id: release.id },
      include: { app: true, deployments: { where: { environment: "PRODUCTION" }, select: { id: true, status: true } } },
    });
    if (!lockedRelease || !lockedRelease.app.appType || lockedRelease.status !== "PENDING") {
      return { error: "RELEASE_NOT_DEPLOYABLE", status: 409 };
    }
    const existing = lockedRelease.deployments[0];
    if (existing && !["FAILED"].includes(existing.status)) {
      return { error: "DEPLOYMENT_ALREADY_IN_PROGRESS", status: 409 };
    }
    const deployment = await transaction.appDeployment.upsert({
      where: { appReleaseId_environment: { appReleaseId: lockedRelease.id, environment: "PRODUCTION" } },
      create: { appReleaseId: lockedRelease.id, environment: "PRODUCTION", runtimeBaseUrl: null, status: "PROVISIONING" },
      update: { status: "PROVISIONING", runtimeBaseUrl: null, healthCheckedAt: null },
    });
    await transaction.appManagedRuntime.upsert({
      where: { appDeploymentId: deployment.id },
      create: { appDeploymentId: deployment.id, provider: "VERCEL" },
      update: {
        failureCode: null,
        failureMessage: null,
        providerProjectId: null,
        providerDeploymentId: null,
        publicRuntimeUrl: null,
        reconciledAt: null,
      },
    });
    return {
      id: deployment.id,
      appId: lockedRelease.app.appType,
      version: lockedRelease.version,
      repoUrl: lockedRelease.sourceRepoUrl!,
      sourceRevision: lockedRelease.sourceRevision!,
      manifest: manifest.data,
    };
  });
}

function failureResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "INVALID_ORIGIN";
  return NextResponse.json({ error: message === "INVALID_ORIGIN" ? message : "FORBIDDEN" }, { status: 403 });
}

export async function POST(request: NextRequest, routeContext: RouteContext) {
  try {
    requireSameOrigin(request);
  } catch (error) {
    return failureResponse(error);
  }
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const prepared = await prepareDeployment((await routeContext.params).releaseId);
  if ("error" in prepared) return NextResponse.json({ error: prepared.error }, { status: prepared.status });

  const oidcToken = getVercelOidcToken(request.headers);
  if (!oidcToken) {
    await db.appDeployment.update({ where: { id: prepared.id }, data: { status: "FAILED" } });
    await db.appManagedRuntime.update({ where: { appDeploymentId: prepared.id }, data: { failureCode: "PROVIDER_CREDENTIALS_UNAVAILABLE", failureMessage: "Managed provider credentials are not configured." } });
    return NextResponse.json({ error: "MANAGED_DEPLOYMENT_FAILED" }, { status: 502 });
  }

  const sandboxFactory = createVercelSandboxFactory();
  let runtimeUrl: string | undefined;
  const result = await orchestrateManagedDeployment({
    async markProvisioning() {
      await db.appDeployment.update({ where: { id: prepared.id }, data: { status: "PROVISIONING" } });
    },
    async validate() {
      const { manifestDigest } = await validateRelease(sandboxFactory, {
        appId: prepared.appId,
        version: prepared.version,
        repoUrl: prepared.repoUrl,
        sourceRevision: prepared.sourceRevision,
        manifest: prepared.manifest,
      });
      return { artifactDigest: manifestDigest, capabilities: [...prepared.manifest.capabilities] };
    },
    async provisionDatabase() {
      const provision = await provisionAppDatabaseFromEnvironment({ appId: prepared.appId, deploymentId: prepared.id });
      await db.appManagedRuntime.update({ where: { appDeploymentId: prepared.id }, data: { provisionedAt: new Date() } });
      return { migrationUrl: provision.migrationUrl, runtimeUrl: provision.runtimeUrl };
    },
    async runMigration(migrationUrl) {
      await runIsolatedMigration(sandboxFactory, {
        appId: prepared.appId,
        repoUrl: prepared.repoUrl,
        sourceRevision: prepared.sourceRevision,
        manifest: prepared.manifest,
        migrationUrl,
      });
    },
    async deploy(databaseUrl) {
      const provider = await deployValidatedRelease(sandboxFactory, {
        appId: prepared.appId,
        repoUrl: prepared.repoUrl,
        revision: prepared.sourceRevision,
        oidcToken,
        platformUrl: process.env.NEXTAUTH_URL || "https://appai.info",
        ...(databaseUrl ? { databaseUrl } : {}),
      });
      runtimeUrl = provider.publicRuntimeUrl;
      return provider;
    },
    async persistEvidence(evidence) {
      await db.$transaction([
        db.appRelease.update({ where: { id: (await routeContext.params).releaseId }, data: { artifactDigest: evidence.artifactDigest } }),
        db.appManagedRuntime.update({
          where: { appDeploymentId: prepared.id },
          data: {
            providerProjectId: evidence.providerProjectId,
            providerDeploymentId: evidence.providerDeploymentId,
            publicRuntimeUrl: evidence.publicRuntimeUrl,
          },
        }),
      ]);
    },
    async healthCheck() {
      if (!runtimeUrl) throw new Error("PROVIDER_RUNTIME_URL_MISSING");
      await checkManagedRuntimeHealthWithRetry(runtimeUrl, {
        appId: prepared.appId,
        version: prepared.version,
        healthPath: prepared.manifest.runtime.healthPath,
      });
    },
    async activate(capabilities) {
      if (!runtimeUrl) throw new Error("PROVIDER_RUNTIME_URL_MISSING");
      await activateVerifiedManagedRuntimeInDatabase({
        appId: prepared.appId,
        releaseId: (await routeContext.params).releaseId,
        deploymentId: prepared.id,
        verifiedRuntimeBaseUrl: runtimeUrl,
        healthCheckedAt: new Date(),
        approvedCapabilities: capabilities,
      });
    },
    async fail(code, message) {
      await db.$transaction([
        db.appDeployment.update({ where: { id: prepared.id }, data: { status: "FAILED" } }),
        db.appManagedRuntime.update({ where: { appDeploymentId: prepared.id }, data: { failureCode: code, failureMessage: message } }),
      ]);
    },
  }, {
    migrationDeclared: Boolean(prepared.manifest.runtime.migrationCommand),
    databaseRequired: prepared.manifest.capabilities.includes("database"),
  });

  if (!result.ok) return NextResponse.json({ error: "MANAGED_DEPLOYMENT_FAILED", deploymentId: prepared.id }, { status: 502 });
  return NextResponse.json({ deploymentId: prepared.id, status: "ACTIVE" });
}
