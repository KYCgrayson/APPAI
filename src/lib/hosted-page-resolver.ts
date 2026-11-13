import { publicPageWhere, publicRootSelect } from "./hosted-page-visibility";
import { cache } from "react";
import { convertChineseVariant, oppositeChineseLocale, chineseSourceLocales } from "./zh-convert";
import { db } from "@/lib/db";

/** Resolve a root page from DB: explicit locale or default */
export const resolvePage = cache(async function resolvePage(slug: string, explicitLocale: string | null) {
  if (explicitLocale) {
    const exact = await db.hostedPage.findFirst({
      where: { slug, locale: explicitLocale, ...publicPageWhere() },
    });
    if (exact) return { ...exact, autoConverted: false };
    const opposite = oppositeChineseLocale(explicitLocale);
    if (!opposite) return null;
    const sources = await db.hostedPage.findMany({ where: { slug, locale: { in: chineseSourceLocales(explicitLocale) }, ...publicPageWhere() } , orderBy: { locale: "asc" } });
    const source = sources.find(row => row.locale === opposite) ?? sources[0];
    return source ? convertChineseVariant(source, explicitLocale) : null;
  }
  // No locale in URL — find the default, fallback to first
  const defaultPage = await db.hostedPage.findFirst({
    where: { slug, ...publicPageWhere() },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return defaultPage ? { ...defaultPage, autoConverted: false } : null;
});

/** Resolve a child page (parentSlug=root.slug) within the same organization. */
export const resolveChildPage = cache(async function resolveChildPage(
  parentSlug: string,
  childSlug: string,
  explicitLocale: string | null,
  organizationId: string,
) {
  const root = await resolvePage(parentSlug, explicitLocale);
  if (!root || root.organizationId !== organizationId) return null;
  const roots = await db.hostedPage.findMany({
    where: { ...publicPageWhere(), slug: parentSlug, organizationId }, select: publicRootSelect,
    orderBy: { locale: "asc" },
  });
  if (!roots.length) return null;
  if (explicitLocale) {
    const exact = await db.hostedPage.findFirst({
      where: {
        organizationId,
        parentSlug,
        slug: childSlug,
        locale: explicitLocale,
        ...publicPageWhere(roots),
      },
    });
    if (exact) return { ...exact, autoConverted: false };
    const opposite = oppositeChineseLocale(explicitLocale);
    if (!opposite) return null;
    const sources = await db.hostedPage.findMany({ where: { organizationId, parentSlug, slug: childSlug, locale: { in: chineseSourceLocales(explicitLocale) }, ...publicPageWhere(roots) } , orderBy: { locale: "asc" } });
    const source = sources.find(row => row.locale === opposite) ?? sources[0];
    return source ? convertChineseVariant(source, explicitLocale) : null;
  }
  const defaultPage = await db.hostedPage.findFirst({
    where: {
      organizationId,
      parentSlug,
      slug: childSlug,
      ...publicPageWhere(roots),
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return defaultPage ? { ...defaultPage, autoConverted: false } : null;
});

