import { NextRequest, NextResponse } from "next/server";

import { validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { canReadUniversalApp, mapUniversalAppReleaseStatus } from "@/lib/universal-apps/release-status";
import { universalAppIdSchema } from "@/lib/universal-apps/manifest";

type RouteContext = { params: Promise<{ appId: string; releaseId: string }> };

export async function GET(request: NextRequest, routeContext: RouteContext) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { appId: rawAppId, releaseId } = await routeContext.params;
  const parsedAppId = universalAppIdSchema.safeParse(rawAppId);
  if (!parsedAppId.success) return NextResponse.json({ error: "INVALID_APP_ID" }, { status: 400 });

  const app = await db.app.findUnique({
    where: { appType: parsedAppId.data },
    select: { id: true, organizationId: true },
  });
  if (!app || !canReadUniversalApp(authResult.organizationId, app.organizationId)) {
    return NextResponse.json({ error: "APP_NOT_FOUND" }, { status: 404 });
  }

  const release = await db.appRelease.findFirst({
    where: { id: releaseId, appId: app.id },
    include: { deployments: { orderBy: { createdAt: "desc" } } },
  });
  if (!release) return NextResponse.json({ error: "RELEASE_NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ appId: parsedAppId.data, release: mapUniversalAppReleaseStatus(release) });
}
