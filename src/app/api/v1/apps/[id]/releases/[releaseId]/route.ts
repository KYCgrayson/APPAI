import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { canReadUniversalApp, mapUniversalAppReleaseStatus } from "@/lib/universal-apps/release-status";
import { universalAppIdSchema } from "@/lib/universal-apps/manifest";
import { requirePublisherOrganization } from "@/lib/universal-apps/publisher-auth";

type RouteContext = { params: Promise<{ id: string; releaseId: string }> };

export async function GET(request: NextRequest, routeContext: RouteContext) {
  const authResult = await requirePublisherOrganization(request);
  if (authResult && "error" in authResult) return NextResponse.json({ error: authResult.error }, { status: 403 });
  if (!authResult) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: rawAppId, releaseId } = await routeContext.params;
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
    select: {
      id: true,
      version: true,
      status: true,
      sourceType: true,
      sourceRevision: true,
      artifactDigest: true,
      createdAt: true,
      updatedAt: true,
      deployments: {
        orderBy: { createdAt: "desc" },
        select: {
          environment: true,
          status: true,
          healthCheckedAt: true,
          createdAt: true,
          updatedAt: true,
          managedRuntime: {
            select: {
              failureCode: true,
              failureMessage: true,
            },
          },
        },
      },
    },
  });
  if (!release) return NextResponse.json({ error: "RELEASE_NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ appId: parsedAppId.data, release: mapUniversalAppReleaseStatus(release) });
}
