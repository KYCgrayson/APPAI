import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { createReleasePackageSchema, universalAppIdSchema } from "@/lib/universal-apps/manifest";
import { requirePublisherOrganization } from "@/lib/universal-apps/publisher-auth";
import { createReleasePackageUploadToken, isReleasePackagePrivateStorageNotConfiguredError, RELEASE_PACKAGE_MAX_BYTES, RELEASE_PACKAGE_TTL_MS, releasePackagePath } from "@/lib/universal-apps/release-package";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const authResult = await requirePublisherOrganization(request, true);
  if (authResult && "error" in authResult) return NextResponse.json({ error: authResult.error }, { status: 403 });
  if (!authResult) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appId = universalAppIdSchema.safeParse((await routeContext.params).id);
  const input = createReleasePackageSchema.safeParse(await request.json().catch(() => null));
  if (!appId.success || !input.success) return NextResponse.json({ error: "INVALID_RELEASE_PACKAGE" }, { status: 400 });

  try {
    const existing = await db.app.findUnique({ where: { appType: appId.data }, select: { organizationId: true } });
    if (existing && existing.organizationId !== authResult.organizationId) {
      return NextResponse.json({ error: "APP_ID_TAKEN" }, { status: 409 });
    }

    const expiresAt = new Date(Date.now() + RELEASE_PACKAGE_TTL_MS);
    const pathname = releasePackagePath(authResult.organizationId, appId.data, input.data.filename);
    const upload = await db.appReleasePackage.create({
      data: {
        organizationId: authResult.organizationId,
        appType: appId.data,
        pathname,
        originalName: input.data.filename,
        expectedSizeBytes: input.data.sizeBytes,
        contentType: input.data.contentType,
        expiresAt,
      },
    });
    let clientToken: string;
    try {
      clientToken = await createReleasePackageUploadToken({ pathname, sizeBytes: input.data.sizeBytes, expiresAt });
    } catch (error) {
      // A token was not handed to the caller, so this intent cannot become a
      // usable upload. Expire it rather than leaving an apparently active row.
      await db.appReleasePackage.updateMany({ where: { id: upload.id, status: "UPLOADING" }, data: { status: "EXPIRED" } }).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ uploadId: upload.id, pathname, clientToken, expiresAt, maxSizeBytes: RELEASE_PACKAGE_MAX_BYTES }, { status: 201 });
  } catch (error) {
    if (isReleasePackagePrivateStorageNotConfiguredError(error)) {
      console.error("Release package upload intent unavailable: private storage is not configured");
      return NextResponse.json({ error: "PRIVATE_STORAGE_NOT_CONFIGURED" }, { status: 503 });
    }
    // Do not serialize or log provider/database errors: they may contain
    // connection or credential details and are not actionable to publishers.
    console.error("Release package upload intent failed");
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
