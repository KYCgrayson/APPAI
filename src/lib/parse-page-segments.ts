import { isValidLocale } from "@/lib/validations/page";

const SUBPAGES = ["privacy", "terms"] as const;
export type Subpage = (typeof SUBPAGES)[number];

export interface ParsedSegments {
  slug: string;
  /** Explicit locale from URL, or null if using default */
  locale: string | null;
  subpage: Subpage | null;
}

/**
 * Parse catch-all route segments for hosted pages.
 *
 * Patterns:
 *   ["my-app"]                → slug="my-app", locale=null (use default), subpage=null
 *   ["my-app", "ja"]          → slug="my-app", locale="ja", subpage=null
 *   ["my-app", "privacy"]     → slug="my-app", locale=null, subpage="privacy"
 *   ["my-app", "ja", "privacy"] → slug="my-app", locale="ja", subpage="privacy"
 */
export function parsePageSegments(segments: string[]): ParsedSegments | null {
  if (!segments || segments.length === 0 || segments.length > 3) return null;

  const slug = segments[0];

  if (segments.length === 1) {
    return { slug, locale: null, subpage: null };
  }

  if (segments.length === 2) {
    const second = segments[1];
    if (SUBPAGES.includes(second as Subpage)) {
      return { slug, locale: null, subpage: second as Subpage };
    }
    if (isValidLocale(second)) {
      return { slug, locale: second, subpage: null };
    }
    return null;
  }

  if (segments.length === 3) {
    const [, locale, subpage] = segments;
    if (isValidLocale(locale) && SUBPAGES.includes(subpage as Subpage)) {
      return { slug, locale, subpage: subpage as Subpage };
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
