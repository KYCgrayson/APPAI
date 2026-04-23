import { db } from "@/lib/db";
import { sanitizeUrl } from "@/lib/sanitize";

/**
 * Localized label for the root-page "Home" nav entry. Falls back to "Home"
 * for unlisted locales. Keep short — it appears as a nav tab.
 */
export const HOME_LABELS: Record<string, string> = {
  en: "Home",
  "zh-TW": "首頁",
  "zh-CN": "首页",
  ja: "ホーム",
  ko: "홈",
  es: "Inicio",
  fr: "Accueil",
  de: "Startseite",
  pt: "Início",
  "pt-BR": "Início",
  it: "Home",
  nl: "Home",
  ru: "Главная",
  ar: "الرئيسية",
  hi: "होम",
  th: "หน้าแรก",
  vi: "Trang chủ",
  id: "Beranda",
  ms: "Laman Utama",
  tr: "Ana Sayfa",
};

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
  const rows = await db.hostedPage.findMany({
    where: {
      organizationId,
      parentSlug,
      isPublished: true,
      hideFromNav: false,
      OR: [{ locale }, { isDefault: true }],
    },
    select: {
      slug: true,
      locale: true,
      title: true,
      isDefault: true,
      hideFromNav: true,
      navOrder: true,
      createdAt: true,
    },
  });

  const bySlug = new Map<string, SiblingRow>();
  for (const row of rows) {
    const existing = bySlug.get(row.slug);
    if (!existing) {
      bySlug.set(row.slug, row);
      continue;
    }
    if (row.locale === locale && existing.locale !== locale) {
      bySlug.set(row.slug, row);
    }
  }

  return Array.from(bySlug.values()).sort((a, b) => {
    const ao = a.navOrder;
    const bo = b.navOrder;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/**
 * Build the navigation list for a site. Priority:
 *   1. Explicit `content.nav` array on the root page (escape hatch)
 *   2. Auto-generated: localized "Home" + one entry per visible child
 *   3. Empty list when the site is single-page
 */
export function buildNav(
  rootContent: unknown,
  siblings: SiblingRow[],
  rootHref: string,
  locale: string,
): NavItem[] {
  const explicit = (rootContent as { nav?: unknown })?.nav;
  if (Array.isArray(explicit)) {
    return explicit
      .filter((item): item is NavItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as NavItem).label === "string" &&
        typeof (item as NavItem).target === "string",
      )
      .map((item) => ({ label: item.label, target: item.target }));
  }
  if (siblings.length === 0) return [];
  const homeLabel = HOME_LABELS[locale] || HOME_LABELS.en;
  return [
    { label: homeLabel, target: rootHref },
    ...siblings.map((s) => ({ label: s.title, target: s.slug })),
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
