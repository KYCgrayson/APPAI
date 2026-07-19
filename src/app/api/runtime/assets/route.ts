import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getPrivateBlobAuth } from "@/lib/private-assets/auth";
import { safePrivateAssetFilename, validatePrivateAssetFile } from "@/lib/private-assets/file-validation";
import { evaluatePrivateAssetQuota, getPrivateAssetLimits } from "@/lib/private-assets/limits";
import { requireUniversalRuntimeContext, UniversalAppRuntimeError } from "@/lib/universal-apps/runtime-session";

export async function POST(request: NextRequest) {
  try {
    const context = await requireUniversalRuntimeContext(request, "private-assets");
    const blobAuth = getPrivateBlobAuth();
    if (!blobAuth.configured) return NextResponse.json({ error: "PRIVATE_STORAGE_NOT_CONFIGURED" }, { status: 503 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    const validation = await validatePrivateAssetFile(file);
    if (!validation.valid) return NextResponse.json({ error: "INVALID_FILE", message: validation.error }, { status: 400 });

    const usage = await db.privateAsset.aggregate({
      where: {
        organizationId: context.organizationId,
        appType: context.appId,
        status: { in: ["ACTIVE", "DELETE_PENDING"] },
      },
      _sum: { sizeBytes: true },
    });
    const quota = evaluatePrivateAssetQuota(usage._sum.sizeBytes ?? 0, file.size, getPrivateAssetLimits());
    if (!quota.allowed) {
      return NextResponse.json({ error: quota.reason, usagePercent: Math.round(quota.currentPercent) }, {
        status: quota.reason === "FILE_TOO_LARGE" ? 413 : 429,
      });
    }

    const id = randomUUID();
    const filename = safePrivateAssetFilename(file.name);
    const pathname = `${context.appId}/${context.organizationId}/${id}/${filename}`;
    const blob = await put(pathname, file, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: false,
      ...blobAuth.options,
    });

    try {
      const [asset] = await db.$transaction([
        db.privateAsset.create({
          data: {
            id,
            organizationId: context.organizationId,
            appType: context.appId,
            pathname: blob.pathname,
            originalName: file.name.slice(0, 240),
            contentType: file.type,
            sizeBytes: file.size,
            createdByUserId: context.userId,
          },
        }),
        db.usageEvent.create({
          data: {
            connector: `universal-app:${context.appId}`,
            organizationId: context.organizationId,
            userId: context.userId,
            action: "private-asset.uploaded",
            meta: { assetId: id, sizeBytes: file.size, contentType: file.type },
          },
        }),
      ]);
      return NextResponse.json({
        asset: {
          id: asset.id,
          filename: asset.originalName,
          contentType: asset.contentType,
          sizeBytes: asset.sizeBytes,
          downloadPath: `/api/runtime/assets/${asset.id}`,
        },
        quota: { level: quota.level, projectedPercent: Math.round(quota.projectedPercent) },
      }, { status: 201 });
    } catch (error) {
      await del(blob.pathname, blobAuth.options).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof UniversalAppRuntimeError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("Universal private asset upload failed", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
