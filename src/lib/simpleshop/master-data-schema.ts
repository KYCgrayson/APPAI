import { z } from "zod";

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const resourceId = z.string().trim().min(1).max(64);
export const masterDataIdSchema = resourceId;

export const customerStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const jobSiteStatusSchema = z.enum(["ACTIVE", "COMPLETED", "INACTIVE"]);
export const dimensionModeSchema = z.enum(["NONE", "OPTIONAL", "REQUIRED"]);
export const calculationMethodSchema = z.enum(["QUANTITY", "CONVERSION", "BOARD_MEASURE"]);
export const itemStatusSchema = z.enum(["ACTIVE", "PENDING", "INACTIVE"]);

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  shortName: nullableText(80),
  phone: nullableText(50),
  address: nullableText(500),
  paymentTermsDays: z.number().int().min(0).max(3650).nullable().optional(),
  status: customerStatusSchema.default("ACTIVE"),
  notes: nullableText(2000),
}).strict();

export const customerPatchSchema = customerCreateSchema.partial().strict();

const aliasesSchema = z.array(z.string().trim().min(1).max(160)).max(20).default([]);

export const jobSiteCreateSchema = z.object({
  customerId: resourceId,
  name: z.string().trim().min(1).max(160),
  keyword: nullableText(80),
  address: nullableText(500),
  contactName: nullableText(120),
  contactPhone: nullableText(50),
  status: jobSiteStatusSchema.default("ACTIVE"),
  notes: nullableText(2000),
  aliases: aliasesSchema,
}).strict();

export const jobSitePatchSchema = jobSiteCreateSchema
  .omit({ customerId: true })
  .partial()
  .strict();

const positiveDimension = z.number().positive().max(1_000_000).nullable().optional();

export const itemUnitInputSchema = z.object({
  unitCode: z.string().trim().min(1).max(24).transform((value) => value.toUpperCase()),
  label: z.string().trim().min(1).max(80),
  conversionRate: z.number().positive().max(1_000_000_000).nullable().optional(),
}).strict();

const itemShape = z.object({
  categoryName: nullableText(120),
  itemCode: z.string().trim().min(1).max(80),
  canonicalName: z.string().trim().min(1).max(200),
  material: nullableText(120),
  grade: nullableText(120),
  dimensionMode: dimensionModeSchema.default("NONE"),
  length: positiveDimension,
  width: positiveDimension,
  thickness: positiveDimension,
  dimensionUnit: nullableText(24),
  defaultUnit: z.string().trim().min(1).max(24).transform((value) => value.toUpperCase()),
  calculationMethod: calculationMethodSchema.default("QUANTITY"),
  status: itemStatusSchema.default("ACTIVE"),
  notes: nullableText(2000),
  aliases: aliasesSchema,
  units: z.array(itemUnitInputSchema).max(20).default([]),
}).strict();

function validateDimensions(
  item: z.infer<typeof itemShape>,
  context: z.RefinementCtx,
) {
  const dimensions = [item.length, item.width, item.thickness];
  if (item.dimensionMode === "NONE" && (dimensions.some((value) => value != null) || item.dimensionUnit)) {
    context.addIssue({
      code: "custom",
      path: ["dimensionMode"],
      message: "NONE mode cannot include dimensions or a dimension unit.",
    });
  }
  if (item.dimensionMode === "REQUIRED" && (dimensions.some((value) => value == null) || !item.dimensionUnit)) {
    context.addIssue({
      code: "custom",
      path: ["dimensionMode"],
      message: "REQUIRED mode needs length, width, thickness and a dimension unit.",
    });
  }
  if (item.dimensionMode === "OPTIONAL" && dimensions.some((value) => value != null) && !item.dimensionUnit) {
    context.addIssue({
      code: "custom",
      path: ["dimensionUnit"],
      message: "A dimension unit is required when dimensions are present.",
    });
  }
  const unitCodes = new Set<string>();
  for (const [index, unit] of item.units.entries()) {
    if (unitCodes.has(unit.unitCode)) {
      context.addIssue({ code: "custom", path: ["units", index, "unitCode"], message: "Unit codes must be unique." });
    }
    unitCodes.add(unit.unitCode);
  }
}

export const itemCreateSchema = itemShape.superRefine(validateDimensions);
export const itemPatchSchema = itemShape.partial().strict();

export const masterDataListQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export function normalizeMasterDataText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-TW");
}

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerPatchInput = z.infer<typeof customerPatchSchema>;
export type JobSiteCreateInput = z.infer<typeof jobSiteCreateSchema>;
export type JobSitePatchInput = z.infer<typeof jobSitePatchSchema>;
export type ItemCreateInput = z.infer<typeof itemCreateSchema>;
export type ItemPatchInput = z.infer<typeof itemPatchSchema>;
