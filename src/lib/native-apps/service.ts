import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { NativeAppError } from "@/lib/native-apps/errors";
import {
  getNativeAppDefinition,
  type NativeAppType,
} from "@/lib/native-apps/registry";
import {
  mergeSimpleshopSettings,
  parseSimpleshopSettings,
  type SimpleshopSettingsPatch,
} from "@/lib/simpleshop/settings-schema";

export async function ensureOrganizationApp(
  organizationId: string,
  appType: NativeAppType,
) {
  const definition = getNativeAppDefinition(appType);
  if (!definition) {
    throw new NativeAppError("UNKNOWN_APP_TYPE", 400, "Unknown native app type.");
  }

  return db.organizationApp.upsert({
    where: { organizationId_appType: { organizationId, appType } },
    create: { organizationId, appType, status: "ACTIVE" },
    update: {},
  });
}

export async function requireActiveOrganizationApp(
  organizationId: string,
  appType: NativeAppType,
) {
  const instance = await db.organizationApp.findUnique({
    where: { organizationId_appType: { organizationId, appType } },
  });

  if (!instance) {
    throw new NativeAppError("APP_NOT_ENABLED", 404, "Native app is not enabled.");
  }
  if (instance.status !== "ACTIVE") {
    throw new NativeAppError("APP_SUSPENDED", 403, "Native app is suspended.");
  }
  return instance;
}

export async function getSimpleshopSettings(organizationId: string) {
  const instance = await requireActiveOrganizationApp(organizationId, "simpleshop");
  return {
    instance,
    settings: parseSimpleshopSettings(instance.config),
  };
}

export async function updateSimpleshopSettings(
  organizationId: string,
  patch: SimpleshopSettingsPatch,
) {
  const instance = await requireActiveOrganizationApp(organizationId, "simpleshop");
  const config = mergeSimpleshopSettings(instance.config, patch);
  const updated = await db.organizationApp.update({
    where: { id: instance.id },
    data: { config: config as Prisma.InputJsonValue },
  });

  return {
    instance: updated,
    settings: parseSimpleshopSettings(updated.config),
  };
}
