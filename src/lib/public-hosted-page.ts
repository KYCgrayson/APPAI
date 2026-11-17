import type { Prisma } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import { hostedDataCache } from "./hosted-page-cache";
import { publicAppFilter, publicPageWhere, publicRootSelect } from "./hosted-page-visibility";
import { chineseSourceLocales, oppositeChineseLocale } from "./zh-convert";
import { appDirectoryKind, isPersonalDirectoryProfile } from "./directory-kind";

// Server-only public publisher data. No Session/User/Organization relation,
// removal audit, custom domain, viewer identity, or issued iframe credentials.
// Publisher section content is unchanged (including simple-order settings);
// PageRenderer retains responsibility for its existing client-safe projection.
export const hostedRenderSelect = {
  id: true, organizationId: true, slug: true, parentSlug: true, locale: true,
  isDefault: true, isPublished: true, template: true, title: true, tagline: true,
  heroImage: true, headerLogo: true, content: true, privacyPolicy: true,
  termsOfService: true, metaTitle: true, metaDescription: true, ogImage: true,
  canonicalUrl: true, customCss: true, themeColor: true, themeColorSecondary: true,
  fontFamily: true, darkMode: true, hideFromNav: true, navOrder: true,
  createdAt: true, updatedAt: true,
} as const satisfies Prisma.HostedPageSelect;
export type PublicHostedPage = Prisma.HostedPageGetPayload<{ select: typeof hostedRenderSelect }>;

function encodePage(page: PublicHostedPage | null) {
  if (!page) return null;
  // Explicit projection also protects callers using a wider in-process row.
  const projected = Object.fromEntries(Object.keys(hostedRenderSelect).map(key =>
    [key, page[key as keyof PublicHostedPage]])) as PublicHostedPage;
  return { ...projected, createdAt: page.createdAt.toISOString(), updatedAt: page.updatedAt.toISOString() };
}
function decodePage(page: ReturnType<typeof encodePage>): PublicHostedPage | null {
  return page ? { ...page, createdAt: new Date(page.createdAt), updatedAt: new Date(page.updatedAt) } : null;
}
const defaultOrder = [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }] as const;

// All callbacks below are leaves: only DB reads and pure DTO projection.
async function readPage(where: Prisma.HostedPageWhereInput, locale: string | null) {
  if (!locale) return db.hostedPage.findFirst({ where, select: hostedRenderSelect, orderBy: [...defaultOrder] });
  const exact = await db.hostedPage.findFirst({ where: { ...where, locale }, select: hostedRenderSelect });
  if (exact) return exact;
  const opposite = oppositeChineseLocale(locale);
  if (!opposite) return null;
  const sources = await db.hostedPage.findMany({
    where: { ...where, locale: { in: chineseSourceLocales(locale) } },
    select: hostedRenderSelect, orderBy: { locale: "asc" },
  });
  return sources.find(row => row.locale === opposite) ?? sources[0] ?? null;
}
const rootData = hostedDataCache("root", async (slug: string, locale: string | null) =>
  encodePage(await readPage({ slug, ...publicPageWhere() }, locale)));
export const loadHostedRoot = cache(async (slug: string, locale: string | null) => decodePage(await rootData(slug, locale)));

const childData = hostedDataCache("child", async (organizationId: string, parentSlug: string, slug: string, locale: string | null) => {
  const roots = await db.hostedPage.findMany({
    where: { ...publicPageWhere(), slug: parentSlug, organizationId }, select: publicRootSelect,
    orderBy: { locale: "asc" },
  });
  return encodePage(roots.length ? await readPage({ organizationId, parentSlug, slug, ...publicPageWhere(roots) }, locale) : null);
});
export const loadHostedChild = cache(async (organizationId: string, parentSlug: string, slug: string, locale: string | null) =>
  decodePage(await childData(organizationId, parentSlug, slug, locale)));

// URL/chrome summaries do not duplicate full section content or Date values.
const variantSelect = {
  ...publicRootSelect, title: true, canonicalUrl: true, privacyPolicy: true, termsOfService: true,
} as const satisfies Prisma.HostedPageSelect;
const rootVariants = hostedDataCache("root-variants", async (slug: string, organizationId: string | null) =>
  db.hostedPage.findMany({
    where: { slug, ...(organizationId === null ? {} : { organizationId }), ...publicPageWhere() },
    select: variantSelect, orderBy: { locale: "asc" },
  }));
export const loadHostedRootVariants = cache(rootVariants);
const childVariants = hostedDataCache("child-variants", async (organizationId: string, parentSlug: string, slug: string) => {
  const roots = await db.hostedPage.findMany({
    where: { slug: parentSlug, organizationId, ...publicPageWhere() }, select: publicRootSelect,
    orderBy: { locale: "asc" },
  });
  return db.hostedPage.findMany({
    where: { organizationId, parentSlug, slug, ...publicPageWhere(roots) },
    select: variantSelect, orderBy: { locale: "asc" },
  });
});
export const loadHostedChildVariants = cache(childVariants);

const siblings = hostedDataCache("siblings", async (organizationId: string, parentSlug: string, locale: string) => {
  const roots = await db.hostedPage.findMany({
    where: { ...publicPageWhere(), organizationId, slug: parentSlug }, select: publicRootSelect,
    orderBy: [{ slug: "asc" }, { locale: "asc" }],
  });
  const rows = await db.hostedPage.findMany({
    where: { organizationId, parentSlug, AND: [publicPageWhere(roots)], hideFromNav: false,
      OR: [{ locale }, { locale: { in: chineseSourceLocales(locale) } }, { isDefault: true }] },
    select: { slug: true, locale: true, title: true, isDefault: true, hideFromNav: true, navOrder: true, createdAt: true },
    orderBy: [{ slug: "asc" }, { locale: "asc" }],
  });
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
});
export const loadHostedSiblingRows = cache(async (organizationId: string, parentSlug: string, locale: string) =>
  (await siblings(organizationId, parentSlug, locale)).map(row => ({ ...row, createdAt: new Date(row.createdAt) })));

const membership = hostedDataCache("membership", async (organizationId: string, slug: string) => {
  const variants = await db.hostedPage.findMany({
    where: { slug, organizationId, ...publicPageWhere() },
    select: { ...publicRootSelect, template: true, content: true },
    orderBy: [{ slug: "asc" }, { locale: "asc" }],
  });
  const app = await db.app.findFirst({
    where: { hostedPageSlug: slug, organizationId, ...publicAppFilter(variants) },
    select: { tags: true, appType: true, hostedPageSlug: true, url: true, iosUrl: true, androidUrl: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return app ? { kind: appDirectoryKind(app, variants), personal: isPersonalDirectoryProfile(variants) } : null;
});
export const loadHostedMembership = cache(membership);
