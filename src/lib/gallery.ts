import { z } from "zod";
import { editorialLink } from "./hosted-editorial-links.ts";
import { PLATFORM_ORIGIN } from "./platform-identity.ts";
import { videoFieldPath } from "./video-data.ts";

export const GALLERY_ASPECTS = ["16:9", "1:1", "4:3", "4:5"] as const;
// Trimmed length in JSON Schema, matching z.string().trim().min(1).max(12).
export const GALLERY_BADGE_PATTERN = "^\\s*\\S(?:[\\s\\S]{0,10}\\S)?\\s*$";

// Validate only the additive contract; legacy URL/type/caption behavior stays intact.
const gallerySchema = z.object({
  layout: z.enum(["masonry", "grid"]).optional(),
  aspect: z.enum(GALLERY_ASPECTS).optional(),
  columns: z.number().int().min(2).max(4).optional(),
  items: z.array(z.object({
    href: z.string().max(2048).refine(value => !!editorialLink(value, PLATFORM_ORIGIN, "project-card"), "Use HTTPS without credentials, /p/... with optional ?t=time/#anchor, #anchor, or ?t=time#anchor").optional(),
    badge: z.string().trim().min(1).max(12).optional(),
    alt: z.string().max(200).optional(),
  }).passthrough().superRefine((item, ctx) => {
    if (item.type === "video" && item.href !== undefined) ctx.addIssue({ code: "custom", path: ["href"], message: "Video items have native controls and cannot have href" });
  })).optional(),
}).passthrough();

/** Shared by all writes, merged patches and previews, before and after sanitizing. */
export function galleryContentIssues(content: unknown) {
  const issues: { code: "custom"; path: (string | number)[]; message: string }[] = [];
  const sections = (content as { sections?: unknown[] } | null)?.sections;
  if (!Array.isArray(sections)) return issues;
  sections.forEach((value, index) => {
    const section = value as { type?: string; data?: unknown } | null;
    if (section?.type !== "gallery" || !section.data) return;
    const parsed = gallerySchema.safeParse(section.data);
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const path = ["sections", index, "data", ...issue.path] as (string | number)[];
      issues.push({ code: "custom", path, message: `${videoFieldPath(path)}: ${issue.message}` });
    }
  });
  return issues;
}
