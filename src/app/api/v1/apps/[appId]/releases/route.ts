import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { publishUniversalAppReleaseSchema, universalAppIdSchema } from "@/lib/universal-apps/manifest";
import { canReadUniversalApp, mapUniversalAppReleaseStatus } from "@/lib/universal-apps/release-status";

type RouteContext = { params: Promise<{ appId: string }> };

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pathAppId = universalAppIdSchema.safeParse((await routeContext.params).appId);
  const input = publishUniversalAppReleaseSchema.safeParse(await request.json().catch(() => null));
  if (!pathAppId.success || !input.success || pathAppId.data !== input.data.manifest.id) {
    return NextResponse.json({ error: "INVALID_RELEASE" }, { status: 400 });
  }

  const existing = await db.app.findUnique({ where: { appType: pathAppId.data } });
  if (existing && existing.organizationId !== authResult.organizationId) {
    return NextResponse.json({ error: "APP_ID_TAKEN" }, { status: 409 });
  }

  try {
    const result = await db.$transaction(async (transaction) => {
      const app = existing
        ? await transaction.app.update({
            where: { id: existing.id },
            data: {
              name: input.data.manifest.name,
              tagline: input.data.tagline,
              description: input.data.description,
              category: input.data.category,
              repoUrl: input.data.repoUrl,
            },
          })
        : await transaction.app.create({
            data: {
              organizationId: authResult.organizationId,
              name: input.data.manifest.name,
              tagline: input.data.tagline,
              description: input.data.description,
              category: input.data.category,
              repoUrl: input.data.repoUrl,
              appType: pathAppId.data,
              runtimePath: `/app/${pathAppId.data}`,
              isApproved: false,
            },
          });

      const release = await transaction.appRelease.create({
        data: {
          appId: app.id,
          version: input.data.manifest.version,
          manifest: input.data.manifest as Prisma.InputJsonValue,
          sourceRevision: input.data.sourceRevision,
          status: "PENDING",
        },
      });
      return { app, release };
    });

    return NextResponse.json({
      appId: result.app.appType,
      releaseId: result.release.id,
      version: result.release.version,
      status: result.release.status,
    }, { status: 202 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "RELEASE_VERSION_EXISTS" }, { status: 409 });
    }
    throw error;
  }
}

export async function GET(request: NextRequest, routeContext: RouteContext) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedAppId = universalAppIdSchema.safeParse((await routeContext.params).appId);
  if (!parsedAppId.success) return NextResponse.json({ error: "INVALID_APP_ID" }, { status: 400 });

  const app = await db.app.findUnique({
    where: { appType: parsedAppId.data },
    select: { id: true, organizationId: true },
  });
  if (!app || !canReadUniversalApp(authResult.organizationId, app.organizationId)) {
    return NextResponse.json({ error: "APP_NOT_FOUND" }, { status: 404 });
  }

  const releases = await db.appRelease.findMany({
    where: { appId: app.id },
    include: { deployments: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    appId: parsedAppId.data,
    releases: releases.map(mapUniversalAppReleaseStatus),
  });
}
