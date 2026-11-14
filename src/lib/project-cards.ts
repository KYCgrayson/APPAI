import { z } from "zod";
import { editorialImageUrl, editorialLink } from "./hosted-editorial-links.ts";
import { videoFieldPath } from "./video-data.ts";
import { PLATFORM_ORIGIN } from "./platform-identity.ts";

export const PROJECT_MEDIA_ASPECTS = ["16:9", "1:1", "4:5"] as const;
const href = z.string().max(2048).refine(value => !!editorialLink(value, PLATFORM_ORIGIN, "project-card"), "Use HTTPS without credentials, /p/... with optional ?t=time/#anchor, #anchor, or ?t=time#anchor");
export const projectCardMediaSchema = z.object({
  url: z.string().refine(editorialImageUrl, "Use an HTTPS image URL without credentials"),
  alt: z.string(),
  href: href.optional(),
  label: z.string().max(24).optional(),
  aspect: z.enum(PROJECT_MEDIA_ASPECTS).optional(),
});
export type ProjectCardMedia = z.infer<typeof projectCardMediaSchema>;

// Validate only the additive contract. Legacy fields keep their existing behavior.
const projectCardsSchema = z.object({
  layout: z.enum(["grid", "feed"]).optional(),
  items: z.array(z.object({
    href: href.optional(),
    meta: z.array(z.string().trim().min(1).max(40)).max(3).optional(),
    media: z.array(projectCardMediaSchema).min(1).max(2).optional(),
    featured: z.boolean().optional(),
  }).passthrough()).optional(),
}).passthrough();

/** Same field paths on create, replace, merged patches, dry-run and preview. */
export function projectCardsContentIssues(content: unknown) {
  const issues: { code: "custom"; path: (string | number)[]; message: string }[] = [];
  const sections = (content as { sections?: unknown[] } | null)?.sections;
  if (!Array.isArray(sections)) return issues;
  sections.forEach((value, index) => {
    const section = value as { type?: string; data?: Record<string, unknown> } | null;
    if (section?.type !== "project-cards" || !section.data) return;
    const parsed = projectCardsSchema.safeParse(section.data);
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const path = ["sections", index, "data", ...issue.path] as (string | number)[];
      issues.push({ code: "custom", path, message: `${videoFieldPath(path)}: ${issue.message}` });
    }
  });
  return issues;
}
