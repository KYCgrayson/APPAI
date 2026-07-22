import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { del } from "@vercel/blob";

import { db } from "@/lib/db";
import { publishUniversalAppReleaseSchema, universalAppIdSchema } from "@/lib/universal-apps/manifest";
import { requirePublisherOrganization } from "@/lib/universal-apps/publisher-auth";
import { readAndVerifyReleasePackage } from "@/lib/universal-apps/release-package";
import { canReadUniversalApp, mapUniversalAppReleaseStatus } from "@/lib/universal-apps/release-status";
import { getPrivateBlobAuth } from "@/lib/private-assets/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const authResult = await requirePublisherOrganization(request, true);
  if (authResult && "error" in authResult) return NextResponse.json({ error: authResult.error }, { status: 403 });
  if (!authResult) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pathAppId = universalAppIdSchema.safeParse((await routeContext.params).id);
  const input = publishUniversalAppReleaseSchema.safeParse(await request.json().catch(() => null));
  if (!pathAppId.success || !input.success || pathAppId.data !== input.data.manifest.id) {
    return NextResponse.json({ error: "INVALID_RELEASE" }, { status: 400 });
  }

  const existing = await db.app.findUnique({ where: { appType: pathAppId.data } });
  if (existing && existing.organizationId !== authResult.organizationId) return NextResponse.json({ error: "APP_ID_TAKEN" }, { status: 409 });

  let packageInput: { id: string; pathname: string; expectedSizeBytes: number; contentType: string } | null = null;
  let packageVerification: { sizeBytes: number; digest: string; contentType: string } | null = null;
  if ("source" in input.data && input.data.source.type === "package") {
    const upload = await db.appReleasePackage.findFirst({
      where: { id: input.data.source.uploadId, organizationId: authResult.organizationId, appType: pathAppId.data, status: "UPLOADING" },
      select: { id: true, pathname: true, expectedSizeBytes: true, contentType: true, expiresAt: true },
    });
    if (!upload) return NextResponse.json({ error: "RELEASE_PACKAGE_NOT_AVAILABLE" }, { status: 409 });
    if (upload.expiresAt <= new Date()) {
      await db.appReleasePackage.updateMany({ where: { id: upload.id, status: "UPLOADING" }, data: { status: "EXPIRED" } });
      const blobAuth = getPrivateBlobAuth();
      if (blobAuth.configured) await del(upload.pathname, blobAuth.options).catch(() => undefined);
      return NextResponse.json({ error: "RELEASE_PACKAGE_NOT_AVAILABLE" }, { status: 409 });
    }
    const verified = await readAndVerifyReleasePackage({ pathname: upload.pathname, expectedDigest: input.data.source.digest, expectedSizeBytes: input.data.source.sizeBytes, expectedContentType: upload.contentType }).catch(() => null);
    if (!verified || !verified.valid || verified.sizeBytes !== upload.expectedSizeBytes) {
      await db.appReleasePackage.updateMany({ where: { id: upload.id, status: "UPLOADING" }, data: { status: "EXPIRED" } });
      const blobAuth = getPrivateBlobAuth();
      if (blobAuth.configured) await del(upload.pathname, blobAuth.options).catch(() => undefined);
      return NextResponse.json({ error: "RELEASE_PACKAGE_INTEGRITY_FAILED" }, { status: 422 });
    }
    packageInput = upload;
    packageVerification = verified;
  }

  try {
    const result = await db.$transaction(async (transaction) => {
      const ownedExisting = await transaction.app.findUnique({ where: { appType: pathAppId.data } });
      if (ownedExisting && ownedExisting.organizationId !== authResult.organizationId) throw new Error("APP_ID_TAKEN");
      if (packageInput) {
        const claim = await transaction.appReleasePackage.updateMany({
          where: { id: packageInput.id, organizationId: authResult.organizationId, appType: pathAppId.data, status: "UPLOADING", expiresAt: { gt: new Date() } },
          data: { status: "CONSUMED", consumedAt: new Date(), actualSizeBytes: packageVerification!.sizeBytes, sourceDigest: packageVerification!.digest },
        });
        if (claim.count !== 1) throw new Error("RELEASE_PACKAGE_NOT_AVAILABLE");
      }
      const appData = {
        name: input.data.manifest.name,
        tagline: input.data.tagline,
        description: input.data.description,
        category: input.data.category,
        ...(!("source" in input.data) ? { repoUrl: input.data.repoUrl } : {}),
      };
      const app = ownedExisting
        ? await transaction.app.update({ where: { id: ownedExisting.id }, data: appData })
        : await transaction.app.create({ data: { organizationId: authResult.organizationId, appType: pathAppId.data, runtimePath: `/app/${pathAppId.data}`, isApproved: false, ...appData } });
      const release = await transaction.appRelease.create({
        data: {
          appId: app.id,
          version: input.data.manifest.version,
          manifest: input.data.manifest as Prisma.InputJsonValue,
          sourceType: "source" in input.data ? "PACKAGE" : "REPOSITORY",
          sourceRepoUrl: "source" in input.data ? null : input.data.repoUrl,
          sourceRevision: "source" in input.data ? null : input.data.sourceRevision,
          // Source-package integrity is recorded on AppReleasePackage. This
          // field is platform build evidence and must stay null until the
          // managed validation/deployment pipeline persists it.
          artifactDigest: null,
          ...(packageInput ? { releasePackage: { connect: { id: packageInput.id } } } : {}),
          status: "PENDING",
        },
      });
      return { app, release };
    });
    return NextResponse.json({ appId: result.app.appType, releaseId: result.release.id, version: result.release.version, status: result.release.status, sourceType: result.release.sourceType }, { status: 202 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "RELEASE_VERSION_EXISTS" }, { status: 409 });
    if (error instanceof Error && (error.message === "APP_ID_TAKEN" || error.message === "RELEASE_PACKAGE_NOT_AVAILABLE")) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}

export async function GET(request: NextRequest, routeContext: RouteContext) {
  const authResult = await requirePublisherOrganization(request);
  if (authResult && "error" in authResult) return NextResponse.json({ error: authResult.error }, { status: 403 });
  if (!authResult) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedAppId = universalAppIdSchema.safeParse((await routeContext.params).id);
  if (!parsedAppId.success) return NextResponse.json({ error: "INVALID_APP_ID" }, { status: 400 });
  const app = await db.app.findUnique({ where: { appType: parsedAppId.data }, select: { id: true, organizationId: true } });
  if (!app || !canReadUniversalApp(authResult.organizationId, app.organizationId)) return NextResponse.json({ error: "APP_NOT_FOUND" }, { status: 404 });
  const releases = await db.appRelease.findMany({
    where: { appId: app.id },
    select: { id: true, version: true, status: true, sourceType: true, sourceRevision: true, artifactDigest: true, createdAt: true, updatedAt: true, deployments: { orderBy: { createdAt: "desc" }, select: { environment: true, status: true, healthCheckedAt: true, createdAt: true, updatedAt: true, managedRuntime: { select: { failureCode: true, failureMessage: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ appId: parsedAppId.data, releases: releases.map(mapUniversalAppReleaseStatus) });
}
