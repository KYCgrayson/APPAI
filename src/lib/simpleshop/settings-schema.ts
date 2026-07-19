import { z } from "zod";

const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, "Currency must be a three-letter ISO code.");

const timezoneSchema = z.string().trim().max(100).refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Timezone must be a valid IANA timezone.");

export const simpleshopPrintSettingsSchema = z.object({
  displayName: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(50).default(""),
  address: z.string().trim().max(240).default(""),
}).strict();

export const simpleshopSettingsSchema = z.object({
  shopName: z.string().trim().min(1).max(120).default("我的店家"),
  timezone: timezoneSchema.default("Asia/Taipei"),
  currency: currencySchema.default("TWD"),
  print: simpleshopPrintSettingsSchema.default({
    displayName: "",
    phone: "",
    address: "",
  }),
}).strict();

export const simpleshopSettingsPatchSchema = z.object({
  shopName: z.string().trim().min(1).max(120).optional(),
  timezone: timezoneSchema.optional(),
  currency: currencySchema.optional(),
  print: simpleshopPrintSettingsSchema.partial().strict().optional(),
}).strict();

export const simpleshopConfigSchema = z.object({
  schemaVersion: z.literal(1),
  settings: simpleshopSettingsSchema,
}).passthrough();

export type SimpleshopSettings = z.infer<typeof simpleshopSettingsSchema>;
export type SimpleshopSettingsPatch = z.infer<typeof simpleshopSettingsPatchSchema>;

export function parseSimpleshopSettings(config: unknown): SimpleshopSettings {
  const parsed = simpleshopConfigSchema.safeParse(config);
  return parsed.success ? parsed.data.settings : simpleshopSettingsSchema.parse({});
}

export function mergeSimpleshopSettings(
  config: unknown,
  patch: SimpleshopSettingsPatch,
): Record<string, unknown> {
  const existingObject = config && typeof config === "object" && !Array.isArray(config)
    ? { ...(config as Record<string, unknown>) }
    : {};
  const current = parseSimpleshopSettings(config);
  const settings = simpleshopSettingsSchema.parse({
    ...current,
    ...patch,
    print: { ...current.print, ...patch.print },
  });

  return {
    ...existingObject,
    schemaVersion: 1,
    settings,
  };
}
