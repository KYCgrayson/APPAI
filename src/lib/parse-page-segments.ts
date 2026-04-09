import { isValidLocale } from "@/lib/validations/page";

const SUBPAGES = ["privacy", "terms"] as const;
export type Subpage = (typeof SUBPAGES)[number];

const CHILD_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,99}$/;

export interface ParsedSegments {
  slug: string;
  /** Explicit locale from URL, or null if using default */
  locale: string | null;
  /** Legacy privacy/terms subpage stored on the parent HostedPage */
  subpage: Subpage | null;
  /** Multi-page sites: child page slug under the root `slug` */
  childSlug: string | null;
}

/**
 * Parse catch-all route segments for hosted pages.
 *
 * Resolution priority for the second segment when it is not a locale:
 *   1. Legacy privacy/terms subpage (stored on the parent HostedPage row)
 *   2. Child page slug (separate HostedPage row with parentSlug=root.slug)
 *
 * Patterns:
 *   ["my-app"]                       → slug="my-app", locale=null, subpage=null, childSlug=null
 *   ["my-app", "ja"]                 → slug="my-app", locale="ja", subpage=null, childSlug=null
 *   ["my-app", "privacy"]            → slug="my-app", locale=null, subpage="privacy", childSlug=null
 *   ["my-app", "faq"]                → slug="my-app", locale=null, subpage=null, childSlug="faq"
 *   ["my-app", "ja", "privacy"]      → slug="my-app", locale="ja", subpage="privacy", childSlug=null
 *   ["my-app", "ja", "faq"]          → slug="my-app", locale="ja", subpage=null, childSlug="faq"
 */
export function parsePageSegments(segments: string[]): ParsedSegments | null {
  if (!segments || segments.length === 0 || segments.length > 3) return null;

  const slug = segments[0];
  if (!CHILD_SLUG_REGEX.test(slug)) return null;

  if (segments.length === 1) {
    return { slug, locale: null, subpage: null, childSlug: null };
  }

  if (segments.length === 2) {
    const second = segments[1];
    if (SUBPAGES.includes(second as Subpage)) {
      return { slug, locale: null, subpage: second as Subpage, childSlug: null };
    }
    if (isValidLocale(second)) {
      return { slug, locale: second, subpage: null, childSlug: null };
    }
    if (CHILD_SLUG_REGEX.test(second)) {
      return { slug, locale: null, subpage: null, childSlug: second };
    }
    return null;
  }

  if (segments.length === 3) {
    const [, locale, third] = segments;
    if (!isValidLocale(locale)) return null;
    if (SUBPAGES.includes(third as Subpage)) {
      return { slug, locale, subpage: third as Subpage, childSlug: null };
    }
    if (CHILD_SLUG_REGEX.test(third)) {
      return { slug, locale, subpage: null, childSlug: third };
    }
    return null;
  }

  return null;
}

/** Build the URL path for a hosted page. Uses isDefault to determine if locale suffix is needed. */
export function buildPagePath(slug: string, locale: string, subpage?: string | null, isDefault?: boolean): string {
  const parts = [`/p/${slug}`];
  if (!isDefault) parts.push(locale);
  if (subpage) parts.push(subpage);
  return parts.join("/");
}
