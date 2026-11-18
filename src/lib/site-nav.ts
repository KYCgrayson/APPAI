import { chineseFallback } from "./zh-convert";
import { loadHostedSiblingRows } from "./public-hosted-page";
import { sanitizeUrl } from "@/lib/sanitize";
import { hostedNavigationCopy } from "./hosted-navigation-copy.ts";

export { HOME_LABELS } from "./hosted-navigation-copy.ts";

export type SiblingRow = {
  slug: string;
  locale: string;
  title: string;
  isDefault: boolean;
  hideFromNav: boolean;
  navOrder: number | null;
  createdAt: Date;
};

export interface NavItem {
  label: string;
  /** Child page slug, anchor (#section), or absolute URL */
  target: string;
}

/**
 * Load all sibling child pages for the site nav. Returns one entry per logical
 * page (slug), with the title chosen by locale preference:
 *   1. current-locale variant if it exists
 *   2. default-locale variant otherwise
 * Entries with hideFromNav=true are omitted. Sort is (navOrder asc, createdAt asc),
 * with nulls last so explicit ordering wins over accidental creation order.
 */
export async function loadSiblings(
  parentSlug: string,
  organizationId: string,
  locale: string,
): Promise<SiblingRow[]> {
  const rows = await loadHostedSiblingRows(organizationId, parentSlug, locale);

  const grouped = new Map<string, SiblingRow[]>();
  for (const row of rows) grouped.set(row.slug, [...(grouped.get(row.slug) ?? []), row]);
  const bySlug = new Map<string, SiblingRow>();
  for (const [slug, variants] of grouped) {
    bySlug.set(slug, chineseFallback(variants, locale) ?? variants.find(v => v.locale === locale) ?? variants.find(v => v.isDefault) ?? variants[0]);
  }

  return Array.from(bySlug.values()).sort((a, b) => {
    const ao = a.navOrder;
    const bo = b.navOrder;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime() || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  });
}

/**
 * Build the navigation list for a site. Priority:
 *   1. Explicit `content.nav` array on the root page (escape hatch)
 *   2. Auto-generated: localized "Home" + one entry per visible child
 * Non-root pages always include Home, including explicit/empty navigation.
 * A root with no visible children does not get a Home-only nav.
 */
export function buildNav(
  rootContent: unknown,
  siblings: SiblingRow[],
  rootHref: string,
  locale: string,
  isRootPage = true,
): NavItem[] {
  const homeLabel = hostedNavigationCopy(locale).home;
  const home = { label: homeLabel, target: rootHref };
  const explicit = (rootContent as { nav?: unknown })?.nav;
  if (Array.isArray(explicit)) {
    const items = explicit
      .filter((item): item is NavItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as NavItem).label === "string" &&
        typeof (item as NavItem).target === "string",
      )
      .map((item) => ({ label: item.label, target: item.target }));
    if (!isRootPage && !items.some(item => item.target === rootHref)) items.unshift(home);
    return items;
  }
  if (siblings.length === 0) return isRootPage ? [] : [home];
  return [
    home,
    // Resolve child slugs against the current URL locale, including Chinese
    // conversion routes whose requested locale differs from the stored row.
    ...siblings.map(s => ({ label: s.title, target: s.slug })),
  ];
}

/**
 * Resolve a NavItem.target into a real href + external flag.
 *
 *   "https://..."     → external URL, opens in new tab
 *   "#anchor"         → in-page anchor
 *   "/p/..."          → absolute internal path (used by Home)
 *   "child-slug"      → child page on the same root site
 */
export function resolveNavHref(
  target: string,
  rootSlug: string,
  localeSegment: string,
): { href: string; external: boolean } {
  if (typeof target !== "string") return { href: "#", external: false };
  if (/^https?:\/\//i.test(target)) {
    return { href: sanitizeUrl(target), external: true };
  }
  if (target.startsWith("#") || target.startsWith("/")) {
    return { href: target, external: false };
  }
  const parts = ["/p", rootSlug];
  if (localeSegment) parts.push(localeSegment);
  parts.push(target);
  return { href: parts.join("/"), external: false };
}

export { hostedChromeLabels } from "./hosted-chrome-labels.ts";
