import { del, get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrganizationContext } from "@/lib/organization-context";
import { requireActiveOrganizationApp } from "@/lib/native-apps/service";
import { nativeAppErrorResponse } from "@/lib/native-apps/responses";
import { requireSameOrigin } from "@/lib/request-security";

async function ownedAsset(id: string, organizationId: string) {
  return db.privateAsset.findFirst({
    where: { id, organizationId, appType: "simpleshop" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  void request;
  try {
    const context = await requireOrganizationContext();
    await requireActiveOrganizationApp(context.organizationId, "simpleshop");
    const { id } = await params;
    const asset = await ownedAsset(id, context.organizationId);
    if (!asset || asset.status !== "ACTIVE") {
      return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
    }

    const token = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
    if (!token) return NextResponse.json({ error: "PRIVATE_STORAGE_NOT_CONFIGURED" }, { status: 503 });
    const result = await get(asset.pathname, { access: "private", token, useCache: false });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": asset.contentType,
        "Content-Length": String(asset.sizeBytes),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireOrganizationContext();
    requireSameOrigin(request);
    await requireActiveOrganizationApp(context.organizationId, "simpleshop");
    const { id } = await params;
    const asset = await ownedAsset(id, context.organizationId);
    if (!asset || asset.status === "DELETED") {
      return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
    }

    const token = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
    if (!token) return NextResponse.json({ error: "PRIVATE_STORAGE_NOT_CONFIGURED" }, { status: 503 });
    await db.privateAsset.update({
      where: { id: asset.id },
      data: {
        status: "DELETE_PENDING",
        deletedAt: new Date(),
        deletedByUserId: context.userId,
      },
    });

    try {
      await del(asset.pathname, { token });
    } catch (error) {
      console.error("Private Blob deletion pending", { assetId: asset.id, error });
      return NextResponse.json({ error: "DELETE_PENDING" }, { status: 502 });
    }

    await db.$transaction([
      db.privateAsset.update({
        where: { id: asset.id },
        data: { status: "DELETED" },
      }),
      db.usageEvent.create({
        data: {
          connector: "native-app:simpleshop",
          organizationId: context.organizationId,
          userId: context.userId,
          action: "private-asset.deleted",
          meta: { assetId: asset.id, sizeBytes: asset.sizeBytes },
        },
      }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}
