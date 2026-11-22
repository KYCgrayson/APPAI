import { z } from "zod";
import { editorialImageUrl, editorialLink } from "./hosted-editorial-links.ts";
import { videoFieldPath } from "./video-data.ts";
import { PLATFORM_ORIGIN } from "./platform-identity.ts";

export const PROJECT_MEDIA_ASPECTS = ["16:9", "1:1", "4:5"] as const;
export const PROJECT_CARD_PAGE_SIZES = [10, 20] as const;
const cardDate = z.iso.date();
export const PROJECT_CARD_DATE_PATTERN = z.regexes.date.source;
export const PROJECT_CARD_PUBLISHED_AT_PATTERN = `^(?=.{10}T[0-9]{2}:[0-9]{2}:[0-9]{2})${z.regexes.datetime({ offset: true }).source.slice(1)}`;
const publishedAt = z.string().regex(new RegExp(PROJECT_CARD_PUBLISHED_AT_PATTERN), "Use an ISO datetime with seconds and a timezone");
const paginationSchema = z.object({ defaultSize: z.literal(PROJECT_CARD_PAGE_SIZES) }).strict();
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
  sort: z.literal("date-desc").optional(),
  pagination: paginationSchema.optional(),
  items: z.array(z.object({
    date: cardDate.optional(),
    publishedAt: publishedAt.optional(),
    href: href.optional(),
    meta: z.array(z.string().trim().min(1).max(40)).max(3).optional(),
    media: z.array(projectCardMediaSchema).min(1).max(2).optional(),
    featured: z.boolean().optional(),
  }).passthrough()).optional(),
}).passthrough();

type CardSection = { type?: string; data?: Record<string, unknown> } | null;
function contentSections(content: unknown): CardSection[] {
  const sections = (content as { sections?: CardSection[] } | null)?.sections;
  return Array.isArray(sections) ? sections : [];
}

/** Partial writes validate touched fields and check the section limit on the full merged page. */
export function projectCardsContentIssues(content: unknown, fullContent = content) {
  const issues: { code: "custom"; path: (string | number)[]; message: string }[] = [];
  contentSections(content).forEach((section, index) => {
    if (section?.type !== "project-cards" || !section.data) return;
    const parsed = projectCardsSchema.safeParse(section.data);
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const path = ["sections", index, "data", ...issue.path] as (string | number)[];
      issues.push({ code: "custom", path, message: `${videoFieldPath(path)}: ${issue.message}` });
    }
  });
  let hasPagination = false;
  contentSections(fullContent).forEach((section, index) => {
    if (section?.type !== "project-cards" || !section.data || !projectCardsDefaultSize(section.data)) return;
    if (hasPagination) {
      const path = ["sections", index, "data", "pagination"];
      issues.push({ code: "custom", path, message: `${videoFieldPath(path)}: only one project-cards section per page can use pagination` });
    }
    hasPagination = true;
  });
  return issues;
}

type PageSize = typeof PROJECT_CARD_PAGE_SIZES[number];
export type ProjectCardsQuery = Record<string, string | string[] | undefined>;
export type ProjectCardsPagination = {
  page: number;
  size: PageSize;
  defaultSize: PageSize;
  pageCount: number;
  noindex: boolean;
  canonicalPage: number;
};
export type ProjectCardsControls = ProjectCardsPagination & { path: string };

export function projectCardsDefaultSize(data: Record<string, unknown>): PageSize | undefined {
  const config = paginationSchema.safeParse(data.pagination);
  return config.data?.defaultSize;
}

function paginatableItems(items: unknown): Record<string, unknown>[] {
  return Array.isArray(items) ? items.filter(item => typeof item?.name === "string" && item.name.trim()) : [];
}

/** Undefined means pagination is disabled; null means the requested page does not exist. */
export function resolveProjectCardsPagination(
  sections: readonly { type: string; data: Record<string, unknown> }[],
  query: ProjectCardsQuery,
): ProjectCardsPagination | null | undefined {
  const section = sections.find(section => section.type === "project-cards" && projectCardsDefaultSize(section.data));
  const defaultSize = section && projectCardsDefaultSize(section.data);
  if (!section || !defaultSize) return undefined;
  const size = PROJECT_CARD_PAGE_SIZES.find(size => String(size) === query.size) ?? defaultSize;
  const page = query.page === undefined ? 1
    : typeof query.page === "string" && /^[1-9][0-9]*$/.test(query.page) ? Number(query.page) : NaN;
  const pageCount = Math.max(1, Math.ceil(paginatableItems(section.data.items).length / size));
  if (!Number.isSafeInteger(page) || page > pageCount) return null;
  return {
    page, size, defaultSize, pageCount,
    noindex: size !== defaultSize || query.size === "20",
    canonicalPage: Math.floor(((page - 1) * size) / defaultSize) + 1,
  };
}

export function projectCardsPageHref(path: string, page: number, size?: PageSize) {
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  if (size !== undefined) query.set("size", String(size));
  return query.size ? `${path}?${query}` : path;
}

export function projectCardsItems(data: Record<string, unknown>, pagination?: ProjectCardsPagination): unknown[] {
  const items = pagination ? paginatableItems(data.items) : Array.isArray(data.items) ? data.items : [];
  const sorted = data.sort === "date-desc" ? items.map((item, index) => {
    const fields = item as { date?: unknown; publishedAt?: unknown } | null;
    const date = cardDate.safeParse(fields?.date).data ?? "";
    const timestamp = publishedAt.safeParse(fields?.publishedAt).data;
    return {
      item, index, date,
      time: timestamp ? Date.parse(timestamp) : -Infinity,
      fraction: timestamp?.match(/\.(\d+)/)?.[1].replace(/0+$/, "") ?? "",
    };
  }).sort((a, b) => b.date.localeCompare(a.date) || b.time - a.time
    || b.fraction.localeCompare(a.fraction) || a.index - b.index).map(({ item }) => item) : items;
  if (!pagination) return sorted;
  const start = (pagination.page - 1) * pagination.size;
  return sorted.slice(start, start + pagination.size);
}
