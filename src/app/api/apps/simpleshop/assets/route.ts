import { randomUUID } from "crypto";
import { del, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrganizationContext } from "@/lib/organization-context";
import { requireActiveOrganizationApp } from "@/lib/native-apps/service";
import { nativeAppErrorResponse } from "@/lib/native-apps/responses";
import { evaluatePrivateAssetQuota, getPrivateAssetLimits } from "@/lib/private-assets/limits";
import { safePrivateAssetFilename, validatePrivateAssetFile } from "@/lib/private-assets/file-validation";
import { getPrivateBlobAuth } from "@/lib/private-assets/auth";
import { requireSameOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  try {
    const context = await requireOrganizationContext();
    requireSameOrigin(request);
    await requireActiveOrganizationApp(context.organizationId, "simpleshop");
    const blobAuth = getPrivateBlobAuth();
    if (!blobAuth.configured) {
      return NextResponse.json(
        { error: "PRIVATE_STORAGE_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    }

    const fileValidation = await validatePrivateAssetFile(file);
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: "INVALID_FILE", message: fileValidation.error },
        { status: 400 },
      );
    }

    const usage = await db.privateAsset.aggregate({
      where: {
        organizationId: context.organizationId,
        appType: "simpleshop",
        status: { in: ["ACTIVE", "DELETE_PENDING"] },
      },
      _sum: { sizeBytes: true },
    });
    const limits = getPrivateAssetLimits();
    const quota = evaluatePrivateAssetQuota(usage._sum.sizeBytes ?? 0, file.size, limits);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.reason, usagePercent: Math.round(quota.currentPercent) },
        { status: quota.reason === "FILE_TOO_LARGE" ? 413 : 429 },
      );
    }

    const id = randomUUID();
    const filename = safePrivateAssetFilename(file.name);
    const pathname = `simpleshop/${context.organizationId}/${id}/${filename}`;
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
            appType: "simpleshop",
            pathname: blob.pathname,
            originalName: file.name.slice(0, 240),
            contentType: file.type,
            sizeBytes: file.size,
            createdByUserId: context.userId,
          },
        }),
        db.usageEvent.create({
          data: {
            connector: "native-app:simpleshop",
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
          downloadPath: `/api/apps/simpleshop/assets/${asset.id}`,
        },
        quota: {
          level: quota.level,
          projectedPercent: Math.round(quota.projectedPercent),
        },
      }, { status: 201 });
    } catch (error) {
      await del(blob.pathname, blobAuth.options).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}
