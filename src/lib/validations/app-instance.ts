import { z } from "zod";
import { simpleshopSettingsPatchSchema } from "../simpleshop/settings-schema.ts";

export const createAppInstanceSchema = z.object({
  appType: z.string().trim().min(1).max(50),
  config: simpleshopSettingsPatchSchema.optional(),
}).strict();
