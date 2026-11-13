import { chineseSourceLocales } from "./zh-convert.ts";
import { buildPagePath, parsePageSegments, type Subpage } from "./parse-page-segments.ts";
import { PLATFORM_ORIGIN } from "./platform-identity.ts";

export interface HostedUrlPage {
  slug: string;
  parentSlug?: string | null;
  organizationId: string;
  locale: string;
  isDefault: boolean;
  canonicalUrl?: string | null;
  privacyPolicy?: string | null;
  termsOfService?: string | null;
}

/** A default child resolves independently of its parent's default locale. */
export function hostedPagePath(page: HostedUrlPage, roots: readonly HostedUrlPage[], subpage?: Subpage | null): string | null {
  if (page.parentSlug && !roots.some(root => root.slug === page.parentSlug
    && root.organizationId === page.organizationId && (!root.parentSlug)
    && (page.isDefault || root.locale === page.locale || chineseSourceLocales(page.locale).includes(root.locale)))) return null;
  if (subpage && (page.parentSlug || !(subpage === "privacy" ? page.privacyPolicy : page.termsOfService)?.trim())) return null;
  return buildPagePath(page.parentSlug || page.slug, page.locale, subpage || (page.parentSlug ? page.slug : null), page.isDefault);
}

export function hostedPageUrl(page: HostedUrlPage, roots: readonly HostedUrlPage[], origin = PLATFORM_ORIGIN, subpage?: Subpage | null): string | null {
  const path = hostedPagePath(page, roots, subpage);
  return path ? `${origin.replace(/\/$/, "")}${path}` : null;
}

/** Explicit publisher nav must not advertise an empty built-in policy either. */
export function isUnavailableHostedPolicyLink(href: string, roots: readonly HostedUrlPage[]): boolean {
  let url: URL;
  try { url = new URL(href, PLATFORM_ORIGIN); }
  catch { return false; }
  if (url.origin !== PLATFORM_ORIGIN || !url.pathname.startsWith("/p/")) return false;
  const parsed = parsePageSegments(url.pathname.slice(3).split("/").filter(Boolean));
  if (!parsed?.subpage || !roots.some(root => root.slug === parsed.slug)) return false;
  const candidates = roots.filter(root => root.slug === parsed.slug && !root.parentSlug);
  const root = parsed.locale
    ? candidates.find(root => root.locale === parsed.locale)
      ?? candidates.find(root => chineseSourceLocales(parsed.locale!).includes(root.locale))
    : candidates.find(root => root.isDefault) ?? candidates[0];
  return !root || !hostedPagePath(root, roots, parsed.subpage);
}

export function hasExternalCanonical(page: HostedUrlPage, origin = PLATFORM_ORIGIN): boolean {
  if (!page.canonicalUrl) return false;
  try {
    const canonical = new URL(page.canonicalUrl);
    return ![new URL(origin).origin, PLATFORM_ORIGIN, "https://www.appai.info"].includes(canonical.origin);
  } catch { return false; }
}

export function hostedAlternates(variants: readonly HostedUrlPage[], roots: readonly HostedUrlPage[], origin = PLATFORM_ORIGIN, subpage?: Subpage | null) {
  const languages: Record<string, string> = {};
  for (const variant of [...variants].sort((a, b) => a.locale < b.locale ? -1 : a.locale > b.locale ? 1 : 0)) {
    if (!subpage && hasExternalCanonical(variant, origin)) continue;
    const url = hostedPageUrl(variant, roots, origin, subpage);
    if (!url) continue;
    languages[variant.locale] = url;
    if (variant.isDefault) languages["x-default"] = url;
  }
  return languages;
}
