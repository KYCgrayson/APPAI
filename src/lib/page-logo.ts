import type { SanitizeWarning } from "./sanitize.ts";

export const LOGO_GUIDANCE = "Agents MUST provide a logo for every root page; create one if the user has none: square 512x512 PNG, app-icon style with its own background. Set content.logo (or hero data.logo / headerLogo) to an HTTPS URL or appai.info /path. For a local file, use POST /api/v1/upload and use the returned URL. heroImage does not count as a logo for directory cards or this warning; the header still falls back to it. Non-blocking publishing is a platform fallback, not permission to skip the logo.";

type LogoPage = { content?: unknown; headerLogo?: unknown; parentSlug?: unknown };

/** Logos must use HTTPS or a same-origin root-relative path. */
export function isLogoUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const logo = value.trim();
  if (/^\/(?![\/\\])/.test(logo) && !/[\\\r\n\t]/.test(logo)) return true;
  try { return new URL(logo).protocol === "https:"; } catch { return false; }
}

function logoCandidates(value: unknown, headerLogo?: unknown) {
  const content = value as { logo?: unknown; sections?: { type?: string; data?: { logo?: unknown } }[] } | null;
  return [headerLogo, content?.logo,
    ...(Array.isArray(content?.sections) ? content.sections.filter(s => s?.type === "hero").map(s => s.data?.logo) : [])];
}

/** Pure, shared directory-logo selection. Background photos are never logos. */
export function extractLogoFromContent(value: unknown, headerLogo?: unknown): string | null {
  return logoCandidates(value, headerLogo).find(isLogoUrl)?.trim() || null;
}

/** Header branding uses the root, preferring its primary logo in dark chrome. */
export function hostedHeaderLogo(page: LogoPage & { heroImage?: string | null }, dark: boolean): string | null {
  return (dark ? extractLogoFromContent(page.content) : null)
    || extractLogoFromContent(page.content, page.headerLogo) || page.heroImage || null;
}

export function pageLogoWarnings(page: LogoPage): SanitizeWarning[] {
  // Child pages render the root page's header and have no separate directory card.
  if (page.parentSlug) return [];
  const logo = logoCandidates(page.content, page.headerLogo).find((v): v is string => typeof v === "string" && !!v.trim());
  if (!logo) return [{ path: "content.logo", message: `Missing root page logo. ${LOGO_GUIDANCE}` }];
  return isLogoUrl(logo) ? [] : [{ path: "content.logo", message: `Logo URL must use HTTPS (or an appai.info /path). ${LOGO_GUIDANCE}` }];
}

/** Omit absent logos so page edits preserve logos set through the Apps API. */
export function pageLogoUpdate(content: unknown, headerLogo?: unknown): { logoUrl?: string } {
  const logo = extractLogoFromContent(content, headerLogo);
  return logo ? { logoUrl: logo } : {};
}
