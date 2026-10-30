export const DIRECTORY_KINDS = ["websites", "tools", "apps"] as const;

export type DirectoryKind = (typeof DIRECTORY_KINDS)[number];

const EXPLICIT_KIND_TAG = /^appai:kind:(website|tool|app)$/;
const TOOL_SECTIONS = new Set([
  "iframe-tool",
  "tool",
  "media-downloader",
  "video-subtitle",
]);
const WEBSITE_TEMPLATES = new Set(["PORTFOLIO", "COMPANY_PROFILE", "LINK_IN_BIO"]);
// These published pages predate the current directory taxonomy and all kept
// APP_LANDING as their template, so their original intent cannot be recovered
// from template metadata alone. Keep this reviewed slug list explicit.
const LEGACY_WEBSITE_SLUGS = new Set([
  "demo-profile",
  "demo-portfolio",
  "demo-links",
  "demo-event",
]);

export function explicitDirectoryKind(tags: string[] | null | undefined): DirectoryKind | null {
  for (const tag of tags ?? []) {
    const match = EXPLICIT_KIND_TAG.exec(tag);
    if (match?.[1] === "website") return "websites";
    if (match?.[1] === "tool") return "tools";
    if (match?.[1] === "app") return "apps";
  }
  return null;
}

/** Classify from published root-page data only; App.category remains a purpose category. */
export function inferDirectoryKind(input: {
  tags?: string[] | null;
  appType?: string | null;
  hostedPageSlug?: string | null;
  template?: string | null;
  sectionTypes?: string[];
}): DirectoryKind {
  if (input.appType) return "apps";
  const explicit = explicitDirectoryKind(input.tags);
  if (explicit) return explicit;
  if (input.hostedPageSlug && LEGACY_WEBSITE_SLUGS.has(input.hostedPageSlug)) return "websites";
  if (input.sectionTypes?.some((section) => TOOL_SECTIONS.has(section))) return "tools";
  if (input.template && WEBSITE_TEMPLATES.has(input.template)) return "websites";
  return "apps";
}
