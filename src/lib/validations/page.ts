import { z } from "zod";

export const SUPPORTED_LOCALES = [
  "en", "zh-CN", "zh-TW", "ja", "ko",
  "es", "fr", "de", "pt", "pt-BR",
  "it", "nl", "ru", "ar", "hi",
  "th", "vi", "id", "ms", "tr",
  "pl", "uk", "sv", "da", "fi",
  "nb", "cs", "el", "he", "ro",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Validate a BCP 47 locale string */
export function isValidLocale(locale: string): boolean {
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(locale);
}

export const createPageSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  locale: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Must be a BCP 47 locale code (e.g. 'en', 'ja', 'zh-CN')")
    .default("en")
    .optional(),
  template: z
    .enum(["APP_LANDING", "COMPANY_PROFILE", "PRODUCT_SHOWCASE", "PORTFOLIO", "LINK_IN_BIO"])
    .default("APP_LANDING"),
  title: z.string().min(1).max(200),
  tagline: z.string().max(500).optional(),
  heroImage: z.string().url().optional(),
  headerLogo: z.string().url().optional(),
  content: z.record(z.string(), z.any()).default({}),
  privacyPolicy: z.string().optional(),
  termsOfService: z.string().optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  ogImage: z.string().url().optional(),
  canonicalUrl: z.string().url().optional(),
  customCss: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const dangerous = /<\/style>/i.test(val)
          || /<script/i.test(val)
          || /javascript\s*:/i.test(val)
          || /expression\s*\(/i.test(val)
          || /url\s*\(\s*['"]?\s*javascript/i.test(val);
        return !dangerous;
      },
      { message: "Custom CSS contains disallowed patterns" }
    ),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  themeColorSecondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: z.string().max(100).optional(),
  darkMode: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  // Multi-page sites: when set, this page is a child of the root page with
  // slug=parentSlug in the same organization. null/undefined means this IS a
  // root page. Only one level of nesting is supported (no grandchildren).
  parentSlug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "parentSlug must be lowercase alphanumeric with hyphens")
    .nullable()
    .optional(),
  // Optional: override auto-detected category for the App listing
  category: z
    .enum([
      "WRITING", "CODING", "DESIGN", "AUTOMATION", "PRODUCTIVITY",
      "SOCIAL", "FINANCE", "HEALTH", "EDUCATION",
      "FOOD", "TRAVEL", "ENTERTAINMENT", "GAMES", "MEDIA",
      "UTILITIES", "COMMERCE",
      "OTHER",
    ])
    .optional(),
});

export const updatePageSchema = createPageSchema.partial();

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
