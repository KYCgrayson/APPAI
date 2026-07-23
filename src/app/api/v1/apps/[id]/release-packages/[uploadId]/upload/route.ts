import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getPrivateBlobAuth } from "@/lib/private-assets/auth";
import { universalAppIdSchema } from "@/lib/universal-apps/manifest";
import { requirePublisherOrganization } from "@/lib/universal-apps/publisher-auth";
import {
  canUploadReleasePackageOnServer,
  isWithinReleasePackageServerRequestLimit,
  RELEASE_PACKAGE_CONTENT_TYPES,
  RELEASE_PACKAGE_SERVER_UPLOAD_MAX_BYTES,
} from "@/lib/universal-apps/release-package";

type RouteContext = { params: Promise<{ id: string; uploadId: string }> };

/**
 * Small-package browser fallback. It is deliberately same-origin/authenticated
 * and never returns a Blob pathname, URL, or upload credential. Final release
 * creation still re-reads and verifies the private Blob before claiming it.
 */
export async function POST(request: NextRequest, routeContext: RouteContext) {
  const authResult = await requirePublisherOrganization(request, true);
  if (authResult && "error" in authResult) return NextResponse.json({ error: authResult.error }, { status: 403 });
  if (!authResult) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, uploadId } = await routeContext.params;
  const appId = universalAppIdSchema.safeParse(id);
  if (!appId.success || !/^c[a-z0-9]{24}$/i.test(uploadId)) return NextResponse.json({ error: "INVALID_RELEASE_PACKAGE" }, { status: 400 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "INVALID_UPLOAD_BODY" }, { status: 415 });
  }
  if (!isWithinReleasePackageServerRequestLimit(request.headers.get("content-length"))) {
    return NextResponse.json({ error: "UPLOAD_TOO_LARGE", maxServerUploadBytes: RELEASE_PACKAGE_SERVER_UPLOAD_MAX_BYTES }, { status: 413 });
  }

  const upload = await db.appReleasePackage.findFirst({
    where: { id: uploadId, organizationId: authResult.organizationId, appType: appId.data },
    select: { id: true, organizationId: true, appType: true, pathname: true, expectedSizeBytes: true, contentType: true, status: true, expiresAt: true },
  });
  // Do not distinguish a different organization's upload from a missing one.
  if (!upload) return NextResponse.json({ error: "RELEASE_PACKAGE_NOT_AVAILABLE" }, { status: 409 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const hasOnlyFile = formData && [...formData.keys()].every((key) => key === "file") && [...formData.getAll("file")].length === 1;
  if (!(file instanceof File) || !hasOnlyFile) return NextResponse.json({ error: "INVALID_UPLOAD_BODY" }, { status: 400 });

  if (!canUploadReleasePackageOnServer(upload, {
    organizationId: authResult.organizationId,
    appType: appId.data,
    now: new Date(),
    sizeBytes: file.size,
    contentType: file.type,
  }, RELEASE_PACKAGE_CONTENT_TYPES)) {
    if (upload.expiresAt <= new Date()) {
      await db.appReleasePackage.updateMany({ where: { id: upload.id, status: "UPLOADING" }, data: { status: "EXPIRED" } });
    }
    return NextResponse.json({ error: "RELEASE_PACKAGE_NOT_AVAILABLE" }, { status: 409 });
  }

  const blobAuth = getPrivateBlobAuth();
  if (!blobAuth.configured) return NextResponse.json({ error: "PRIVATE_STORAGE_NOT_CONFIGURED" }, { status: 503 });

  try {
    await put(upload.pathname, file, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: false,
      allowOverwrite: false,
      ...blobAuth.options,
    });
    return NextResponse.json({ uploadId: upload.id, status: "UPLOADING" }, { status: 201 });
  } catch {
    // Provider details can contain operational information and are not useful
    // to a publisher. The upload remains unclaimed and can safely be retried.
    return NextResponse.json({ error: "PACKAGE_UPLOAD_FAILED" }, { status: 502 });
  }
}
