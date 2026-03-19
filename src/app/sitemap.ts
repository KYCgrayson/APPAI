import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { buildPagePath } from "@/lib/parse-page-segments";
import { locales } from "@/i18n/routing";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";

  // Static pages with locale alternates
  const staticPaths = [
    { path: "", changeFrequency: "daily" as const, priority: 1 },
    { path: "/apps", changeFrequency: "daily" as const, priority: 0.8 },
    { path: "/login", changeFrequency: "monthly" as const, priority: 0.3 },
  ];

  const staticPages: MetadataRoute.Sitemap = staticPaths.map((page) => {
    const languages: Record<string, string> = {};
    for (const locale of locales) {
      const prefix = locale === "en" ? "" : `/${locale}`;
      languages[locale] = `${baseUrl}${prefix}${page.path}`;
    }
    languages["x-default"] = `${baseUrl}${page.path}`;

    return {
      url: `${baseUrl}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    };
  });

  // Published hosted pages (all locales)
  const pages = await db.hostedPage.findMany({
    where: { isPublished: true },
    select: { slug: true, locale: true, isDefault: true, updatedAt: true, privacyPolicy: true, termsOfService: true },
  });

  // Group pages by slug to build hreflang alternates
  const slugGroups = new Map<string, typeof pages>();
  for (const page of pages) {
    const group = slugGroups.get(page.slug) || [];
    group.push(page);
    slugGroups.set(page.slug, group);
  }

  const pageEntries: MetadataRoute.Sitemap = pages.flatMap((page) => {
    const siblings = slugGroups.get(page.slug) || [];

    // Build hreflang alternates for this slug
    const languages: Record<string, string> = {};
    for (const sibling of siblings) {
      languages[sibling.locale] = `${baseUrl}${buildPagePath(page.slug, sibling.locale, null, sibling.isDefault)}`;
    }
    const defaultSibling = siblings.find((s) => s.isDefault) || siblings[0];
    if (defaultSibling) {
      languages["x-default"] = `${baseUrl}${buildPagePath(page.slug, defaultSibling.locale, null, true)}`;
    }

    const entries: MetadataRoute.Sitemap = [
      {
        url: `${baseUrl}${buildPagePath(page.slug, page.locale, null, page.isDefault)}`,
        lastModified: page.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: { languages },
      },
    ];
    if (page.privacyPolicy) {
      entries.push({
        url: `${baseUrl}${buildPagePath(page.slug, page.locale, "privacy", page.isDefault)}`,
        lastModified: page.updatedAt,
        changeFrequency: "monthly",
        priority: 0.3,
      });
    }
    if (page.termsOfService) {
      entries.push({
        url: `${baseUrl}${buildPagePath(page.slug, page.locale, "terms", page.isDefault)}`,
        lastModified: page.updatedAt,
        changeFrequency: "monthly",
        priority: 0.3,
      });
    }
    return entries;
  });

  // Approved apps (with locale alternates)
  const apps = await db.app.findMany({
    where: { isApproved: true },
    select: { id: true, updatedAt: true, hostedPageSlug: true },
  });

  const appEntries: MetadataRoute.Sitemap = apps
    .filter((app) => !app.hostedPageSlug)
    .map((app) => {
      const languages: Record<string, string> = {};
      for (const locale of locales) {
        const prefix = locale === "en" ? "" : `/${locale}`;
        languages[locale] = `${baseUrl}${prefix}/apps/${app.id}`;
      }
      languages["x-default"] = `${baseUrl}/apps/${app.id}`;

      return {
        url: `${baseUrl}/apps/${app.id}`,
        lastModified: app.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        alternates: { languages },
      };
    });

  return [...staticPages, ...pageEntries, ...appEntries];
}
