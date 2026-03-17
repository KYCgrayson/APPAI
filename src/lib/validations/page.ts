import { z } from "zod";

export const createPageSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  template: z
    .enum(["APP_LANDING", "COMPANY_PROFILE", "PRODUCT_SHOWCASE", "PORTFOLIO", "LINK_IN_BIO"])
    .default("APP_LANDING"),
  title: z.string().min(1).max(200),
  tagline: z.string().max(500).optional(),
  heroImage: z.string().url().optional(),
  content: z.record(z.string(), z.any()).default({}),
  privacyPolicy: z.string().optional(),
  termsOfService: z.string().optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  ogImage: z.string().url().optional(),
  customCss: z.string().optional(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isPublished: z.boolean().default(false),
  // Optional: override auto-detected category for the App listing
  category: z
    .enum(["WRITING", "CODING", "DESIGN", "AUTOMATION", "PRODUCTIVITY", "SOCIAL", "FINANCE", "HEALTH", "EDUCATION", "OTHER"])
    .optional(),
});

export const updatePageSchema = createPageSchema.partial();

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
