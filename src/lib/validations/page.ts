import { isBusinessHours } from "../business-hours.ts";
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

/** Recognize regex-valid BCP 47 hosted-page URL locale segments. */
export function isValidLocale(locale: string): boolean {
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(locale);
}

const textStep = z.enum(["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]);
const typographyFields = {
  textSize: textStep.optional(),
  textContrast: z.enum(["low", "normal", "high"]).optional(),
  typography: z.object({ caption: textStep.optional(), card: textStep.optional(), body: textStep.optional(), heading: textStep.optional(), display: textStep.optional() }).strict().optional(),
};
const contentSchema = z.object(typographyFields).catchall(z.any()).superRefine((content, ctx) => {
  if (!Array.isArray(content.sections)) return;
  content.sections.forEach((section, index) => {
    if (section?.type === "features" && Array.isArray(section.data?.items)) {
      section.data.items.forEach((item: { price?: unknown }, itemIndex: number) => {
        if (item?.price !== undefined && (typeof item.price !== "string" || item.price.length > 40))
          ctx.addIssue({ code: "custom", path: ["sections", index, "data", "items", itemIndex, "price"], message: "price must be a string of at most 40 characters" });
      });
    }
    if (section?.type !== "contact" || section.data?.hours === undefined) return;
    if (!Array.isArray(section.data.hours) || !section.data.hours.every(isBusinessHours))
      ctx.addIssue({ code: "custom", path: ["sections", index, "data", "hours"], message: "hours must be an array of {days: nonempty mon–sun array, open: HH:MM, close: HH:MM, note?: string (max 200 characters); open and close must differ}" });
  });
});

const pageSchema = z.object({
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
    .enum(["APP_LANDING", "COMPANY_PROFILE", "PRODUCT_SHOWCASE", "PORTFOLIO", "LINK_IN_BIO", "PERSON"])
    .default("APP_LANDING"),
  title: z.string().min(1).max(200),
  tagline: z.string().max(500).optional(),
  heroImage: z.string().url().optional(),
  headerLogo: z.string().refine(value => /^\/(?![\/\\])/.test(value) || URL.canParse(value), "Must be a URL or same-origin /path").optional(),
  content: contentSchema.default({}),
  ...typographyFields,
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
  // Nav controls: hideFromNav excludes a page from the auto-generated site nav
  // (useful for Privacy, Terms, compliance-only landing pages). navOrder sets
  // position in the nav; ties break on createdAt.
  hideFromNav: z.boolean().optional(),
  navOrder: z.number().int().nullable().optional(),
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

export const createPageSchema = pageSchema.refine(
  data => !data.parentSlug || (!isValidLocale(data.slug) && !["privacy", "terms", "tools"].includes(data.slug)),
  { path: ["slug"], message: "Child slug is reserved for hosted locales or privacy, terms, tools; choose a distinct project slug." },
);
export const updatePageSchema = pageSchema.extend({
  locale: pageSchema.shape.locale.unwrap().removeDefault().optional(),
  template: pageSchema.shape.template.removeDefault(),
  content: pageSchema.shape.content.removeDefault(),
  darkMode: pageSchema.shape.darkMode.removeDefault(),
  isPublished: pageSchema.shape.isPublished.removeDefault(),
}).partial();

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
