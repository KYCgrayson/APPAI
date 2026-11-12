import { Prisma, type PrismaClient } from "@prisma/client";
import { hostedPagePath } from "./hosted-page-urls.ts";
import { isPublicChild } from "./hosted-page-visibility.ts";

export const DASHBOARD_PAGE_SIZE = 100;
export type PageSearch = Record<string, string | string[] | undefined>;
export function pageFilters(search: PageSearch) {
  const single = (key: string) => typeof search[key] === "string" ? search[key] as string : "";
  const created = ["7d", "30d", "90d", "all"].includes(single("created")) ? single("created") : "30d";
  const status = ["published", "hidden", "draft", "unpublished", "trash"].includes(single("status")) ? single("status") : "";
  return { q: single("q").trim(), created, status, cursor: single("cursor") };
}
type Filters = ReturnType<typeof pageFilters>;
type Cursor = { createdAt: string; id: string; asOf: string };
function readCursor(value: string): Cursor | null {
  if (!value || value.length > 1024) return null;
  try {
    const c = JSON.parse(Buffer.from(value, "base64url").toString());
    return typeof c.id === "string" && c.id.length > 0 && c.id.length <= 128
      && typeof c.createdAt === "string" && Number.isFinite(Date.parse(c.createdAt))
      && typeof c.asOf === "string" && Number.isFinite(Date.parse(c.asOf)) ? c : null;
  } catch { return null; }
}

export interface PageSummary {
  id: string; organizationId: string; slug: string; parentSlug: string | null;
  title: string; template: string; locale: string; isDefault: boolean;
  removalState?: string | null; removalSource?: string | null; removedAt?: Date | null;
  removedById?: string | null; removedByName?: string | null; lastAgentBlockedAt?: Date | null;
  isPublished: boolean; createdAt: Date; hasPrivacy: boolean; hasTerms: boolean;
}
type LogicalKey = { id: string; slug: string; parentSlug: string | null; createdAt: Date };
export type LogicalPage = LogicalKey & { variants: PageSummary[] };
const key = (page: { parentSlug: string | null; slug: string }) => JSON.stringify([page.parentSlug, page.slug]);

export function pagePresentation(page: PageSummary, roots: readonly PageSummary[]) {
  const visible = isPublicChild(page, roots);
  const publicRoots = roots.filter(root => isPublicChild(root, []));
  const urlPage = { ...page, privacyPolicy: page.hasPrivacy ? "present" : null, termsOfService: page.hasTerms ? "present" : null };
  return {
    status: page.removalState === "DELETED" ? "In Trash" : page.removalState ? (page.removalSource === "ADMIN" ? "Unpublished by Admin" : "Unpublished by owner") : !page.isPublished ? "Draft" : visible ? "Published" : "Hidden — root not public",
    view: visible ? hostedPagePath(urlPage, publicRoots) : null,
    privacy: visible ? hostedPagePath(urlPage, publicRoots, "privacy") : null,
    terms: visible ? hostedPagePath(urlPage, publicRoots, "terms") : null,
  };
}

/** Aggregate before filtering/paging: a translation never resets a logical page's age. */
export function logicalPageQuery(organizationId: string, filters: Filters, now: Date, paginate = true) {
  const cursor = readCursor(filters.cursor);
  const asOf = cursor ? new Date(cursor.asOf) : now;
  const since = filters.created === "all" ? null : new Date(asOf.getTime() - Number.parseInt(filters.created) * 86_400_000);
  const pattern = `%${filters.q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
  const visible = Prisma.sql`p."isPublished" AND (p."parentSlug" IS NULL OR EXISTS (
    SELECT 1 FROM "HostedPage" r WHERE r."organizationId"=p."organizationId" AND r."slug"=p."parentSlug"
      AND r."parentSlug" IS NULL AND r."isPublished" AND (p."isDefault" OR r."locale"=p."locale"
        OR (p."locale" IN ('zh-TW','zh-HK','zh-Hant') AND r."locale" IN ('zh-CN','zh-SG','zh-Hans'))
        OR (p."locale" IN ('zh-CN','zh-SG','zh-Hans') AND r."locale" IN ('zh-TW','zh-HK','zh-Hant')))))`;
  const query = Prisma.sql`
    WITH logical_pages AS (
      SELECT "parentSlug", "slug", MIN("createdAt") AS "createdAt", MIN("id") AS "id",
        MAX(CASE WHEN ${visible} THEN 1 ELSE 0 END) AS published,
        MAX(CASE WHEN p."isPublished" AND NOT (${visible}) THEN 1 ELSE 0 END) AS hidden,
        MAX(CASE WHEN NOT p."isPublished" AND p."removalState" IS NULL THEN 1 ELSE 0 END) AS draft,
        MAX(CASE WHEN p."removalState" = 'UNPUBLISHED' THEN 1 ELSE 0 END) AS unpublished,
        MAX(CASE WHEN p."removalState" = 'DELETED' THEN 1 ELSE 0 END) AS trash,
        MAX(CASE WHEN LOWER("title") LIKE ${pattern} ESCAPE '\\'
          OR LOWER("slug") LIKE ${pattern} ESCAPE '\\' THEN 1 ELSE 0 END) AS matches
      FROM "HostedPage" p WHERE "organizationId" = ${organizationId}
      GROUP BY "parentSlug", "slug"
    )
    SELECT "parentSlug", "slug", "createdAt", "id" FROM logical_pages
    WHERE matches = 1 AND "createdAt" <= ${asOf}
      ${since ? Prisma.sql`AND "createdAt" >= ${since}` : Prisma.empty}
      ${filters.status ? Prisma.sql`AND ${Prisma.raw(filters.status)} = 1` : Prisma.empty}
      ${cursor ? Prisma.sql`AND ("createdAt" < ${new Date(cursor.createdAt)} OR ("createdAt" = ${new Date(cursor.createdAt)} AND "id" < ${cursor.id}))` : Prisma.empty}
    ORDER BY "createdAt" DESC, "id" DESC ${paginate ? Prisma.sql`LIMIT ${DASHBOARD_PAGE_SIZE + 1}` : Prisma.empty}`;
  return { query, asOf, cursor };
}

export async function loadDashboardPages(store: Pick<PrismaClient, "$queryRaw">, organizationId: string, filters: Filters, now = new Date()) {
  const { query, asOf, cursor } = logicalPageQuery(organizationId, filters, now);
  const found = await store.$queryRaw<LogicalKey[]>(query);
  const keys = found.slice(0, DASHBOARD_PAGE_SIZE);
  const rootSlugs = [...new Set(keys.map(page => page.parentSlug || page.slug))];
  const summaries = keys.length ? await store.$queryRaw<PageSummary[]>(Prisma.sql`
    SELECT "id", "organizationId", "parentSlug", "slug", "title", "template", "locale", "isDefault", "isPublished", "createdAt", "removalState", "removalSource", "removedAt", "removedById",
      (SELECT "name" FROM "User" WHERE "User"."id"="HostedPage"."removedById") AS "removedByName",
      (SELECT MAX("createdAt") FROM "HostedPageEvent" e WHERE e."pageId"="HostedPage"."id" AND e."action"='agent_blocked') AS "lastAgentBlockedAt",
      ("privacyPolicy" IS NOT NULL AND "privacyPolicy" <> '') AS "hasPrivacy",
      ("termsOfService" IS NOT NULL AND "termsOfService" <> '') AS "hasTerms"
    FROM "HostedPage" WHERE "organizationId" = ${organizationId} AND (
      ("parentSlug" IS NULL AND "slug" IN (${Prisma.join(rootSlugs)})) OR
      ${Prisma.join(keys.map(page => Prisma.sql`("slug" = ${page.slug} AND ${page.parentSlug === null ? Prisma.sql`"parentSlug" IS NULL` : Prisma.sql`"parentSlug" = ${page.parentSlug}`})`), " OR ")}
    ) ORDER BY "isDefault" DESC, "locale" ASC`) : [];
  const variants = new Map<string, PageSummary[]>();
  for (const row of summaries) {
    const k = key(row);
    variants.set(k, [...(variants.get(k) ?? []), row]);
  }
  const roots = summaries.filter(row => row.parentSlug === null);
  const previous = cursor && keys.length ? await store.$queryRaw<{ rootSlug: string }[]>(Prisma.sql`
    SELECT DISTINCT COALESCE("parentSlug", "slug") AS "rootSlug"
    FROM (${logicalPageQuery(organizationId, { ...filters, cursor: "" }, asOf, false).query}) AS earlier
    WHERE COALESCE("parentSlug", "slug") IN (${Prisma.join(rootSlugs)})
      AND ("createdAt" > ${new Date(cursor.createdAt)} OR ("createdAt" = ${new Date(cursor.createdAt)} AND "id" >= ${cursor.id}))`) : [];
  const continued = new Set(previous.map(row => row.rootSlug));
  const groups = new Map<string, { slug: string; title: string; continued: boolean; pages: LogicalPage[] }>();
  for (const page of keys) {
    const rootSlug = page.parentSlug || page.slug;
    if (!groups.has(rootSlug)) {
      groups.set(rootSlug, { slug: rootSlug, title: roots.find(root => root.slug === rootSlug)?.title || rootSlug,
        continued: continued.has(rootSlug), pages: [] });
    }
    groups.get(rootSlug)!.pages.push({ ...page, variants: variants.get(key(page)) ?? [] });
  }
  const last = keys.at(-1);
  const nextCursor = found.length > DASHBOARD_PAGE_SIZE && last
    ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id, asOf: asOf.toISOString() })).toString("base64url") : null;
  return { groups: [...groups.values()], roots, nextCursor };
}

export function dashboardPagesHref(filters: Filters, cursor?: string | null) {
  const query = new URLSearchParams({ created: filters.created });
  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("status", filters.status);
  if (cursor) query.set("cursor", cursor);
  return `/dashboard/pages?${query}`;
}
