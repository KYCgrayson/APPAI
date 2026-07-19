import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { NativeAppError } from "@/lib/native-apps/errors";
import { requireOrganizationContext } from "@/lib/organization-context";
import { approveUniversalAppDeploymentSchema, universalAppManifestSchema } from "@/lib/universal-apps/manifest";

type RouteContext = { params: Promise<{ releaseId: string }> };

export async function POST(request: NextRequest, routeContext: RouteContext) {
  let context;
  try {
    context = await requireOrganizationContext();
  } catch (error) {
    if (error instanceof NativeAppError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    throw error;
  }
  if (context.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const parsed = approveUniversalAppDeploymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_DEPLOYMENT", issues: parsed.error.issues }, { status: 400 });

  const runtimeUrl = new URL(parsed.data.runtimeBaseUrl);
  const validProtocol = process.env.NODE_ENV === "production"
    ? runtimeUrl.protocol === "https:"
    : runtimeUrl.protocol === "https:" || runtimeUrl.protocol === "http:";
  if (
    !validProtocol || runtimeUrl.username || runtimeUrl.password ||
    runtimeUrl.pathname !== "/" || runtimeUrl.search || runtimeUrl.hash
  ) {
    return NextResponse.json({ error: "INVALID_RUNTIME_URL" }, { status: 400 });
  }

  const { releaseId } = await routeContext.params;
  const release = await db.appRelease.findUnique({ where: { id: releaseId }, include: { app: true } });
  if (!release) return NextResponse.json({ error: "RELEASE_NOT_FOUND" }, { status: 404 });

  const manifest = universalAppManifestSchema.safeParse(release.manifest);
  if (!manifest.success || manifest.data.id !== release.app.appType) {
    return NextResponse.json({ error: "INVALID_RELEASE_MANIFEST" }, { status: 409 });
  }

  const deployment = await db.$transaction(async (transaction) => {
    await transaction.app.update({ where: { id: release.appId }, data: { isApproved: true } });
    await transaction.appRelease.update({
      where: { id: release.id },
      data: { status: "APPROVED", artifactDigest: parsed.data.artifactDigest },
    });
    return transaction.appDeployment.upsert({
      where: { appReleaseId_environment: { appReleaseId: release.id, environment: parsed.data.environment } },
      create: {
        appReleaseId: release.id,
        environment: parsed.data.environment,
        runtimeBaseUrl: runtimeUrl.origin,
        status: "ACTIVE",
      },
      update: { runtimeBaseUrl: runtimeUrl.origin, status: "ACTIVE" },
    });
  });

  return NextResponse.json({
    releaseId: release.id,
    deploymentId: deployment.id,
    environment: deployment.environment,
    status: deployment.status,
  }, { status: 201 });
}
