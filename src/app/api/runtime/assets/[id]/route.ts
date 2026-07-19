import { del, get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getPrivateBlobAuth } from "@/lib/private-assets/auth";
import { requireUniversalRuntimeContext, UniversalAppRuntimeError } from "@/lib/universal-apps/runtime-session";

type RouteContext = { params: Promise<{ id: string }> };

async function ownedAsset(id: string, organizationId: string, appId: string) {
  return db.privateAsset.findFirst({ where: { id, organizationId, appType: appId } });
}

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const context = await requireUniversalRuntimeContext(request, "private-assets");
    const asset = await ownedAsset((await routeContext.params).id, context.organizationId, context.appId);
    if (!asset || asset.status !== "ACTIVE") return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });

    const blobAuth = getPrivateBlobAuth();
    if (!blobAuth.configured) return NextResponse.json({ error: "PRIVATE_STORAGE_NOT_CONFIGURED" }, { status: 503 });
    const result = await get(asset.pathname, { access: "private", useCache: false, ...blobAuth.options });
    if (!result || result.statusCode !== 200) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });

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
    if (error instanceof UniversalAppRuntimeError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Universal private asset read failed", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  try {
    const context = await requireUniversalRuntimeContext(request, "private-assets");
    const asset = await ownedAsset((await routeContext.params).id, context.organizationId, context.appId);
    if (!asset || asset.status === "DELETED") return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });

    const blobAuth = getPrivateBlobAuth();
    if (!blobAuth.configured) return NextResponse.json({ error: "PRIVATE_STORAGE_NOT_CONFIGURED" }, { status: 503 });
    await db.privateAsset.update({
      where: { id: asset.id },
      data: { status: "DELETE_PENDING", deletedAt: new Date(), deletedByUserId: context.userId },
    });
    try {
      await del(asset.pathname, blobAuth.options);
    } catch (error) {
      console.error("Universal private asset deletion pending", { assetId: asset.id, error });
      return NextResponse.json({ error: "DELETE_PENDING" }, { status: 502 });
    }

    await db.$transaction([
      db.privateAsset.update({ where: { id: asset.id }, data: { status: "DELETED" } }),
      db.usageEvent.create({
        data: {
          connector: `universal-app:${context.appId}`,
          organizationId: context.organizationId,
          userId: context.userId,
          action: "private-asset.deleted",
          meta: { assetId: asset.id, sizeBytes: asset.sizeBytes },
        },
      }),
    ]);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof UniversalAppRuntimeError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Universal private asset delete failed", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
