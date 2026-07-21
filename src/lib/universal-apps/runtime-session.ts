import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import { universalAppIdSchema, universalAppManifestSchema } from "@/lib/universal-apps/manifest";
import { selectUniversalRuntimeTarget } from "@/lib/universal-apps/cutover";
import { mapPlatformRouteToRuntimePath } from "@/lib/universal-apps/launcher-path";
import {
  reconcileFutureOrganizationAppCapabilities,
  type ManagedRuntimeActivationStore,
} from "@/lib/universal-apps/activation";
import {
  canRevokeUniversalAppSession,
  runtimeSessionMatchesApp,
  runtimeUserBelongsToOrganization,
  sanitizeUniversalRuntimeIdentity,
  universalAppUserRevocationScope,
} from "@/lib/universal-apps/runtime-session-contract";

export {
  canRevokeUniversalAppSession,
  runtimeSessionMatchesApp,
  runtimeUserBelongsToOrganization,
  sanitizeUniversalRuntimeIdentity,
  universalAppUserRevocationScope,
} from "@/lib/universal-apps/runtime-session-contract";

const LAUNCH_CODE_TTL_MS = 60 * 1000;
const RUNTIME_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export class UniversalAppRuntimeError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
    this.name = "UniversalAppRuntimeError";
  }
}

function opaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashRuntimeSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Platform logout hook: invalidate every still-open isolated-app session for one user. */
export async function revokeUniversalAppSessionsForUser(userId: string) {
  return db.appRuntimeSession.updateMany({
    where: universalAppUserRevocationScope(userId),
    data: { revokedAt: new Date() },
  });
}

function runtimeCallbackUrl(baseUrl: string, callbackPath: string, code: string, returnPath: string) {
  const base = new URL(baseUrl);
  if (process.env.NODE_ENV === "production" && base.protocol !== "https:") {
    throw new UniversalAppRuntimeError("INVALID_DEPLOYMENT", 503, "Production runtime must use HTTPS.");
  }
  if (base.username || base.password) {
    throw new UniversalAppRuntimeError("INVALID_DEPLOYMENT", 503, "Runtime URL cannot include credentials.");
  }
  const target = new URL(callbackPath, base.origin);
  target.searchParams.set("code", code);
  target.searchParams.set("returnTo", returnPath);
  return target.toString();
}

export async function createUniversalAppLaunch(input: {
  appId: string;
  organizationId: string;
  userId: string;
  returnPath?: string;
}) {
  const appId = universalAppIdSchema.parse(input.appId);
  const app = await db.app.findFirst({
    where: { appType: appId },
    include: {
      releases: {
        orderBy: { createdAt: "desc" },
        include: {
          deployments: {
            where: { environment: "PRODUCTION" },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
  if (!app) {
    throw new UniversalAppRuntimeError("APP_UNAVAILABLE", 404, "No active app deployment is available.");
  }
  const target = selectUniversalRuntimeTarget(app.releases, app.isApproved);
  if (target.kind === "APP_UNAVAILABLE") {
    throw new UniversalAppRuntimeError("APP_UNAVAILABLE", 404, "No production deployment has been provisioned.");
  }
  if (target.kind === "INVALID_RELEASE") {
    throw new UniversalAppRuntimeError("INVALID_RELEASE", 503, "No approved app release is available.");
  }
  if (target.kind === "INVALID_DEPLOYMENT") {
    throw new UniversalAppRuntimeError("INVALID_DEPLOYMENT", 503, "Production deployment is not active.");
  }
  const { release, deployment } = target;
  if (!deployment.runtimeBaseUrl) {
    throw new UniversalAppRuntimeError("INVALID_DEPLOYMENT", 503, "Production deployment has no verified runtime URL.");
  }

  const manifest = universalAppManifestSchema.parse(release.manifest);
  if (manifest.id !== appId) {
    throw new UniversalAppRuntimeError("INVALID_RELEASE", 503, "Release manifest does not match the app.");
  }
  // `returnPath` is an AppAI URL (`/app/{id}/...`), while the isolated app may
  // expose a different entry path. Only this mapping crosses the boundary.
  const runtimeReturnPath = mapPlatformRouteToRuntimePath(appId, input.returnPath, manifest.entryPath);

  const rawCode = opaqueToken();
  const expiresAt = new Date(Date.now() + LAUNCH_CODE_TTL_MS);
  const organizationApp = await db.$transaction(async (transaction) => {
    const instance = await transaction.organizationApp.upsert({
      where: { organizationId_appType: { organizationId: input.organizationId, appType: appId } },
      create: { organizationId: input.organizationId, appType: appId, status: "ACTIVE" },
      update: {},
    });
    if (instance.status !== "ACTIVE") {
      throw new UniversalAppRuntimeError("APP_SUSPENDED", 403, "This app instance is suspended.");
    }
    // Capability grants are derived from the reconciled active managed runtime,
    // never from a launch request carrying an untrusted manifest.
    await reconcileFutureOrganizationAppCapabilities(
      transaction as unknown as Pick<ManagedRuntimeActivationStore, "appDeployment" | "appCapabilityGrant">,
      { appId, organizationAppId: instance.id },
    );
    await transaction.appLaunchCode.create({
      data: {
        codeHash: hashRuntimeSecret(rawCode),
        organizationAppId: instance.id,
        deploymentId: deployment.id,
        userId: input.userId,
        returnPath: runtimeReturnPath,
        expiresAt,
      },
    });
    return instance;
  });

  return {
    app,
    organizationApp,
    expiresAt,
    callbackUrl: runtimeCallbackUrl(
      deployment.runtimeBaseUrl,
      manifest.callbackPath,
      rawCode,
      runtimeReturnPath,
    ),
  };
}

export async function exchangeUniversalAppLaunchCode(code: string, requestedAppId: string) {
  const appId = universalAppIdSchema.parse(requestedAppId);
  const now = new Date();
  const rawSessionToken = opaqueToken();
  const expiresAt = new Date(Date.now() + RUNTIME_SESSION_TTL_MS);

  const runtimeSession = await db.$transaction(async (transaction) => {
    const launchCode = await transaction.appLaunchCode.findUnique({
      where: { codeHash: hashRuntimeSecret(code) },
      include: {
        organizationApp: true,
        deployment: { include: { appRelease: { include: { app: true } } } },
      },
    });
    if (
      !launchCode || launchCode.consumedAt || launchCode.expiresAt <= now ||
      launchCode.organizationApp.status !== "ACTIVE" ||
      launchCode.deployment.status !== "ACTIVE" ||
      launchCode.deployment.appRelease.status !== "APPROVED" ||
      launchCode.deployment.appRelease.app.appType !== appId
    ) {
      throw new UniversalAppRuntimeError("INVALID_LAUNCH_CODE", 401, "Launch code is invalid or expired.");
    }

    const consumed = await transaction.appLaunchCode.updateMany({
      where: { id: launchCode.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) {
      throw new UniversalAppRuntimeError("INVALID_LAUNCH_CODE", 401, "Launch code was already consumed.");
    }

    return transaction.appRuntimeSession.create({
      data: {
        tokenHash: hashRuntimeSecret(rawSessionToken),
        organizationAppId: launchCode.organizationAppId,
        deploymentId: launchCode.deploymentId,
        userId: launchCode.userId,
        expiresAt,
      },
    });
  });

  return { runtimeSession, sessionToken: rawSessionToken, expiresAt };
}

export async function introspectUniversalAppSession(rawToken: string, requestedAppId: string) {
  const appId = universalAppIdSchema.parse(requestedAppId);
  const session = await db.appRuntimeSession.findUnique({
    where: { tokenHash: hashRuntimeSecret(rawToken) },
    include: {
      organizationApp: {
        include: {
          capabilityGrants: true,
          organization: { select: { id: true, name: true } },
        },
      },
      deployment: { include: { appRelease: { include: { app: true } } } },
    },
  });
  const now = new Date();
  if (!session || !runtimeSessionMatchesApp({
    revokedAt: session.revokedAt,
    expiresAt: session.expiresAt,
    organizationAppStatus: session.organizationApp.status,
    deploymentStatus: session.deployment.status,
    releaseStatus: session.deployment.appRelease.status,
    deployedAppId: session.deployment.appRelease.app.appType,
  }, appId, now)) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, organizationId: true },
  });
  if (!user || !runtimeUserBelongsToOrganization(user.organizationId, session.organizationApp.organizationId)) return null;

  const capabilities = session.organizationApp.capabilityGrants
    .filter((grant) => grant.status === "ACTIVE")
    .map((grant) => grant.capability)
    .sort();

  return {
    active: true as const,
    appId,
    instanceId: session.organizationAppId,
    userId: session.userId,
    organizationId: session.organizationApp.organizationId,
    ...sanitizeUniversalRuntimeIdentity({ user, organization: session.organizationApp.organization, capabilities }),
    capabilities,
    expiresAt: session.expiresAt.toISOString(),
  };
}

export async function revokeUniversalAppSession(rawToken: string, requestedAppId: string) {
  const appId = universalAppIdSchema.parse(requestedAppId);
  const now = new Date();
  const session = await db.appRuntimeSession.findUnique({
    where: { tokenHash: hashRuntimeSecret(rawToken) },
    include: { deployment: { include: { appRelease: { include: { app: true } } } } },
  });
  if (!session || !canRevokeUniversalAppSession(session.deployment.appRelease.app.appType, appId)) return false;

  await db.appRuntimeSession.updateMany({
    where: { id: session.id, tokenHash: hashRuntimeSecret(rawToken), revokedAt: null },
    data: { revokedAt: now },
  });
  return true;
}

export function bearerToken(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length >= 32 ? token : null;
}

export async function requireUniversalRuntimeContext(request: Request, capability: string) {
  const token = bearerToken(request.headers.get("authorization"));
  const appId = request.headers.get("x-appai-app-id");
  if (!token || !appId) {
    throw new UniversalAppRuntimeError("UNAUTHORIZED", 401, "Runtime bearer token is required.");
  }
  const context = await introspectUniversalAppSession(token, appId);
  if (!context) throw new UniversalAppRuntimeError("UNAUTHORIZED", 401, "Runtime session is invalid.");
  if (!context.capabilities.includes(capability)) {
    throw new UniversalAppRuntimeError("CAPABILITY_REQUIRED", 403, `Capability ${capability} is not granted.`);
  }
  return context;
}
