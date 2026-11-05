import { cache } from "react";
import { convertChineseVariant, oppositeChineseLocale, chineseSourceLocales } from "./zh-convert";
import { db } from "@/lib/db";

/** Resolve a root page from DB: explicit locale or default */
export const resolvePage = cache(async function resolvePage(slug: string, explicitLocale: string | null) {
  if (explicitLocale) {
    const exact = await db.hostedPage.findFirst({
      where: { slug, locale: explicitLocale, isPublished: true, parentSlug: null },
    });
    if (exact) return { ...exact, autoConverted: false };
    const opposite = oppositeChineseLocale(explicitLocale);
    if (!opposite) return null;
    const sources = await db.hostedPage.findMany({ where: { slug, locale: { in: chineseSourceLocales(explicitLocale) }, isPublished: true, parentSlug: null } });
    const source = sources.find(row => row.locale === opposite) ?? sources[0];
    return source ? convertChineseVariant(source, explicitLocale) : null;
  }
  // No locale in URL — find the default, fallback to first
  const defaultPage = await db.hostedPage.findFirst({
    where: { slug, isPublished: true, parentSlug: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
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
  if (explicitLocale) {
    const exact = await db.hostedPage.findFirst({
      where: {
        organizationId,
        parentSlug,
        slug: childSlug,
        locale: explicitLocale,
        isPublished: true,
      },
    });
    if (exact) return { ...exact, autoConverted: false };
    const opposite = oppositeChineseLocale(explicitLocale);
    if (!opposite) return null;
    const sources = await db.hostedPage.findMany({ where: { organizationId, parentSlug, slug: childSlug, locale: { in: chineseSourceLocales(explicitLocale) }, isPublished: true } });
    const source = sources.find(row => row.locale === opposite) ?? sources[0];
    return source ? convertChineseVariant(source, explicitLocale) : null;
  }
  const defaultPage = await db.hostedPage.findFirst({
    where: {
      organizationId,
      parentSlug,
      slug: childSlug,
      isPublished: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return defaultPage ? { ...defaultPage, autoConverted: false } : null;
});

