import type { MetadataRoute } from "next";
import { locales } from "../i18n/routing.ts";
import { SPEC_TOPICS } from "./spec-topics.ts";
import { hostedAlternates, hostedPageUrl, hasExternalCanonical, type HostedUrlPage } from "./hosted-page-urls.ts";
import { platformAlternates, platformUrl } from "./platform-seo.ts";
import { PLATFORM_ORIGIN } from "./platform-identity.ts";
import { GAMES, TABLETOP_COLLECTION, gamePageHref, isPlayableGame } from "./games-catalog.ts";

export const SITEMAP_URL_LIMIT = 45_000;
// Leave room below Next's 2 MB serialized data-cache limit, even with hreflangs.
export const SITEMAP_CACHE_BYTE_LIMIT = 1_800_000;
// Update when public platform content changes; never use the generation time.
export const PLATFORM_CONTENT_MODIFIED = "2026-11-18T00:00:00.000Z";
export interface SitemapPage extends HostedUrlPage { updatedAt: Date | string }
export interface SitemapApp { id: string; updatedAt: Date | string; hostedPageSlug: string | null }

export function splitSitemapEntries(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap[] {
  const shards: MetadataRoute.Sitemap[] = [[]];
  let bytes = 2; // JSON array brackets.
  for (const entry of entries) {
    const size = Buffer.byteLength(JSON.stringify(entry), "utf8") + 1;
    let shard = shards[shards.length - 1];
    if (shard.length && (shard.length >= SITEMAP_URL_LIMIT || bytes + size > SITEMAP_CACHE_BYTE_LIMIT)) {
      shard = [];
      shards.push(shard);
      bytes = 2;
    }
    shard.push(entry);
    bytes += size;
  }
  return shards;
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
}

export function sitemapXml(entries: MetadataRoute.Sitemap): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.map(entry => {
    const modified = entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified;
    const alternates = Object.entries(entry.alternates?.languages || {}).flatMap(([locale, href]) =>
      href ? [`<xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(href)}"/>`] : []);
    return [
      `<url><loc>${escapeXml(entry.url)}</loc>`,
      modified ? `<lastmod>${escapeXml(modified)}</lastmod>` : "",
      entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : "",
      entry.priority !== undefined ? `<priority>${entry.priority}</priority>` : "",
      ...alternates, "</url>",
    ].join("");
  }).join("")}</urlset>`;
}

export type DirectoryUpdates = Partial<Record<"/" | "/apps" | "/websites" | "/tools", (Date | string)[]>>;

/** Unknown timestamps are omitted; never substitute the request/build time. */
export function latestContentModified(values: readonly (Date | string)[]): string | undefined {
  let latest = new Date(PLATFORM_CONTENT_MODIFIED).getTime();
  for (const value of values) {
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return undefined;
    latest = Math.max(latest, time);
  }
  return new Date(latest).toISOString();
}

export function buildSitemapEntries(pages: readonly SitemapPage[], apps: readonly SitemapApp[], origin = PLATFORM_ORIGIN, directoryUpdates: DirectoryUpdates = {}): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const path of ["/", "/apps", "/websites", "/tools"] as const) {
    for (const locale of locales) entries.push({
      url: platformUrl(path, locale, origin),
      // Home also shows a live count; its changes have no trustworthy timestamp.
      lastModified: path === "/" ? undefined : latestContentModified(directoryUpdates[path] ?? []),
      changeFrequency: "daily", priority: path === "/" ? 1 : 0.8,
      alternates: { languages: platformAlternates(path, origin) },
    });
  }
  for (const path of ["/games", ...[...GAMES.filter(isPlayableGame), TABLETOP_COLLECTION].map(gamePageHref)]) {
    for (const locale of locales) entries.push({
      url: platformUrl(path, locale, origin),
      lastModified: PLATFORM_CONTENT_MODIFIED,
      changeFrequency: "weekly", priority: 0.7,
      alternates: { languages: platformAlternates(path, origin) },
    });
  }
  // Text/plain agent documents are public, locale-free routes. Unknown dates are omitted.
  for (const path of ["/spec", ...SPEC_TOPICS.map(topic => `/spec/${topic}`)]) {
    entries.push({ url: `${origin.replace(/\/$/, "")}${path}`, changeFrequency: "weekly", priority: 0.5 });
  }
  const roots = new Map<string, SitemapPage[]>();
  const groups = new Map<string, SitemapPage[]>();
  const key = (page: SitemapPage) => `${page.organizationId}/${page.parentSlug || ""}/${page.slug}`;
  for (const page of pages) {
    if (!page.parentSlug) {
      const rootKey = `${page.organizationId}/${page.slug}`;
      roots.set(rootKey, [...(roots.get(rootKey) || []), page]);
    }
    groups.set(key(page), [...(groups.get(key(page)) || []), page]);
  }
  for (const page of pages) {
    const rootVariants = roots.get(`${page.organizationId}/${page.parentSlug || page.slug}`) || [];
    const url = hostedPageUrl(page, rootVariants, origin);
    if (!url) continue;
    const siblings = groups.get(key(page)) || [];
    if (!hasExternalCanonical(page, origin)) entries.push({ url, lastModified: page.updatedAt, changeFrequency: "weekly", priority: 0.7,
      alternates: { languages: hostedAlternates(siblings, rootVariants, origin) } });
    if (page.parentSlug) continue;
    for (const policy of ["privacy", "terms"] as const) {
      const policyUrl = hostedPageUrl(page, rootVariants, origin, policy);
      if (policyUrl) entries.push({ url: policyUrl, lastModified: page.updatedAt, changeFrequency: "monthly", priority: 0.3,
        alternates: { languages: hostedAlternates(siblings, rootVariants, origin, policy) } });
    }
  }
  for (const app of apps) {
    const path = `/apps/${app.id}`;
    for (const locale of locales) entries.push({ url: platformUrl(path, locale, origin), lastModified: app.updatedAt, changeFrequency: "weekly", priority: 0.6,
      alternates: { languages: platformAlternates(path, origin) } });
  }
  return entries.sort((a, b) => a.url.localeCompare(b.url, "en"));
}
