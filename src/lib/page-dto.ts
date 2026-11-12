import type { HostedPage } from "@prisma/client";

export type RemovalPage = Pick<HostedPage, "removalState" | "removalSource" | "removedAt">;
export function removalDto(page: RemovalPage) {
  return page.removalState ? {
    state: page.removalState.toLowerCase(), source: page.removalSource!.toLowerCase(),
    at: page.removedAt, restoreUntil: null,
  } : null;
}

// Deliberate allowlist: future persistence/audit fields never become API fields.
const PAGE_FIELDS = ["id", "slug", "locale", "isDefault", "organizationId", "template", "title",
  "tagline", "heroImage", "headerLogo", "content", "privacyPolicy", "termsOfService", "metaTitle",
  "metaDescription", "ogImage", "canonicalUrl", "customCss", "themeColor", "themeColorSecondary",
  "fontFamily", "darkMode", "isPublished", "customDomain", "parentSlug", "hideFromNav", "navOrder",
  "createdAt", "updatedAt"] as const satisfies readonly (keyof HostedPage)[];
export function toPageDto(page: HostedPage) {
  return { ...Object.fromEntries(PAGE_FIELDS.filter(key => key in page).map(key => [key, page[key]])),
    removedByOwner: removalDto(page) };
}
