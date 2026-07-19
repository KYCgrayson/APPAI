import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import { universalAppIdSchema, universalAppManifestSchema } from "@/lib/universal-apps/manifest";

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
    where: { appType: appId, isApproved: true },
    include: {
      releases: {
        where: {
          status: "APPROVED",
          deployments: { some: { environment: "PRODUCTION", status: "ACTIVE" } },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          deployments: {
            where: { environment: "PRODUCTION", status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  const release = app?.releases[0];
  const deployment = release?.deployments[0];
  if (!app || !release || !deployment) {
    throw new UniversalAppRuntimeError("APP_UNAVAILABLE", 404, "No active app deployment is available.");
  }

  const manifest = universalAppManifestSchema.parse(release.manifest);
  if (manifest.id !== appId) {
    throw new UniversalAppRuntimeError("INVALID_RELEASE", 503, "Release manifest does not match the app.");
  }

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
    await Promise.all(manifest.capabilities.map((capability) => transaction.appCapabilityGrant.upsert({
      where: { organizationAppId_capability: { organizationAppId: instance.id, capability } },
      create: { organizationAppId: instance.id, capability, status: "ACTIVE" },
      update: {},
    })));
    await transaction.appLaunchCode.create({
      data: {
        codeHash: hashRuntimeSecret(rawCode),
        organizationAppId: instance.id,
        deploymentId: deployment.id,
        userId: input.userId,
        returnPath: input.returnPath || manifest.entryPath,
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
      input.returnPath || manifest.entryPath,
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
      organizationApp: { include: { capabilityGrants: true } },
      deployment: { include: { appRelease: { include: { app: true } } } },
    },
  });
  const now = new Date();
  if (
    !session || session.revokedAt || session.expiresAt <= now ||
    session.organizationApp.status !== "ACTIVE" ||
    session.deployment.status !== "ACTIVE" ||
    session.deployment.appRelease.status !== "APPROVED" ||
    session.deployment.appRelease.app.appType !== appId
  ) {
    return null;
  }

  return {
    active: true as const,
    appId,
    instanceId: session.organizationAppId,
    userId: session.userId,
    organizationId: session.organizationApp.organizationId,
    capabilities: session.organizationApp.capabilityGrants
      .filter((grant) => grant.status === "ACTIVE")
      .map((grant) => grant.capability)
      .sort(),
    expiresAt: session.expiresAt.toISOString(),
  };
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
