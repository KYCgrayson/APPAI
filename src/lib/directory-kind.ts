import { normalizeHostedContent } from "./hosted-content.ts";

export const DIRECTORY_KINDS = ["websites", "tools", "apps"] as const;

export type DirectoryKind = (typeof DIRECTORY_KINDS)[number];

const EXPLICIT_KIND_TAG = /^appai:kind:(website|tool|app)$/;
const TOOL_SECTIONS = new Set([
  "iframe-tool",
  "tool",
  "media-downloader",
  "video-subtitle",
]);
// These published pages predate the current directory taxonomy and all kept
// APP_LANDING as their template, so their original intent cannot be recovered
// from template metadata alone. Keep this reviewed slug list explicit.
const LEGACY_WEBSITE_SLUGS = new Set([
  "demo-profile",
  "demo-portfolio",
  "demo-links",
  "demo-event",
]);

// These reviewed platform-owned app pages have only free-text app descriptions,
// with no machine-readable app signal. Long-term fix: tag them appai:kind:app.
const LEGACY_APP_SLUGS = new Set(["shiftsnap", "simpleshop"]);
const APP_STORE_HOSTS = new Set([
  "apps.apple.com", "itunes.apple.com", "play.google.com", "testflight.apple.com",
]);

/** Inspect every content string, including nested arrays and Markdown links. */
function hasStoreLink(value: unknown): boolean {
  if (typeof value === "string") {
    return (value.match(/https?:\/\/[^\s<>"'`]+/gi) ?? []).some((link) => {
      try { return APP_STORE_HOSTS.has(new URL(link).hostname); }
      catch { return false; }
    });
  }
  if (Array.isArray(value)) return value.some(hasStoreLink);
  if (value !== null && typeof value === "object") return Object.values(value).some(hasStoreLink);
  return false;
}

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
  content?: unknown;
  url?: string | null;
  iosUrl?: string | null;
  androidUrl?: string | null;
}): DirectoryKind {
  if (input.appType) return "apps";
  const explicit = explicitDirectoryKind(input.tags);
  if (explicit) return explicit;
  if (input.hostedPageSlug && LEGACY_WEBSITE_SLUGS.has(input.hostedPageSlug)) return "websites";
  if (input.hostedPageSlug && LEGACY_APP_SLUGS.has(input.hostedPageSlug)) return "apps";
  if (input.sectionTypes?.some((section) => TOOL_SECTIONS.has(section))) return "tools";
  if (input.sectionTypes?.includes("download") || input.iosUrl || input.androidUrl || hasStoreLink(input.url) || hasStoreLink(input.content)) return "apps";
  return "websites";
}

/** The personal-pages filter uses the default published root's template. */
export function isPersonalDirectoryProfile(variants: readonly { isDefault: boolean; template: string }[]): boolean {
  return (variants.find(page => page.isDefault) ?? variants[0])?.template === "PERSON";
}

/** Shared directory membership, always using public apps and published root variants. */
export function appDirectoryKind(app: Parameters<typeof inferDirectoryKind>[0], variants: readonly {
  isDefault: boolean; template: string; content: unknown;
}[]): DirectoryKind | null {
  const page = variants.find(candidate => candidate.isDefault) ?? variants[0];
  // /games lists built-in games only; hosted games are absent from the directories.
  if (app.tags?.includes("appai:kind:game") || variants.some(candidate => candidate.template === "GAME")) return null;
  // PERSON profiles live in the separate personal-pages view, not /websites.
  if (isPersonalDirectoryProfile(variants) || (!app.appType && app.hostedPageSlug && !page)) return null;
  return inferDirectoryKind({ ...app, template: page?.template, content: page?.content,
    sectionTypes: normalizeHostedContent(page?.content).sections.map(section => section.type) });
}
