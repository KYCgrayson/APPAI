import { cache } from "react";
import { convertChineseVariant } from "./zh-convert";
import { loadHostedRoot, loadHostedChild } from "./public-hosted-page";

/** Resolve published data from the shared cache; conversion stays request-local. */
export const resolvePage = cache(async function resolvePage(slug: string, explicitLocale: string | null) {
  const page = await loadHostedRoot(slug, explicitLocale);
  return page ? explicitLocale && page.locale !== explicitLocale
    ? convertChineseVariant(page, explicitLocale) : { ...page, autoConverted: false } : null;
});

/** Resolve a child within the public parent's organization and locale boundary. */
export const resolveChildPage = cache(async function resolveChildPage(
  parentSlug: string, childSlug: string, explicitLocale: string | null, organizationId: string,
) {
  const root = await resolvePage(parentSlug, explicitLocale);
  if (!root || root.organizationId !== organizationId) return null;
  const page = await loadHostedChild(organizationId, parentSlug, childSlug, explicitLocale);
  return page ? explicitLocale && page.locale !== explicitLocale
    ? convertChineseVariant(page, explicitLocale) : { ...page, autoConverted: false } : null;
});
