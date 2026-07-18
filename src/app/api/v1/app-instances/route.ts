import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { createAppInstanceSchema } from "@/lib/validations/app-instance";
import {
  getNativeAppDefinition,
  isNativeAppType,
  listNativeAppDefinitions,
} from "@/lib/native-apps/registry";
import {
  ensureOrganizationApp,
  updateSimpleshopSettings,
} from "@/lib/native-apps/service";
import { nativeAppErrorResponse } from "@/lib/native-apps/responses";

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const instances = await db.organizationApp.findMany({
    where: { organizationId: authResult.organizationId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    instances: instances.map((instance) => ({
      ...instance,
      definition: getNativeAppDefinition(instance.appType),
    })),
    approvedApps: listNativeAppDefinitions(),
  });
}

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = createAppInstanceSchema.parse(await request.json());
    if (!isNativeAppType(body.appType)) {
      return NextResponse.json(
        { error: "UNKNOWN_APP_TYPE", approvedTypes: listNativeAppDefinitions().map((app) => app.type) },
        { status: 400 },
      );
    }

    const existed = await db.organizationApp.findUnique({
      where: {
        organizationId_appType: {
          organizationId: authResult.organizationId,
          appType: body.appType,
        },
      },
      select: { id: true },
    });
    let instance = await ensureOrganizationApp(authResult.organizationId, body.appType);

    if (body.config) {
      if (body.appType !== "simpleshop") {
        return NextResponse.json({ error: "CONFIG_NOT_SUPPORTED" }, { status: 400 });
      }
      const updated = await updateSimpleshopSettings(authResult.organizationId, body.config);
      instance = updated.instance;
    }

    await db.usageEvent.create({
      data: {
        connector: "native-app:simpleshop",
        organizationId: authResult.organizationId,
        action: existed ? "instance.accessed" : "instance.activated",
        meta: { appType: body.appType },
      },
    });

    return NextResponse.json(
      { instance, definition: getNativeAppDefinition(body.appType) },
      { status: existed ? 200 : 201 },
    );
  } catch (error) {
    return nativeAppErrorResponse(error);
  }
}
