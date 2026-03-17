import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/apps`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  // Published hosted pages (dynamically generated)
  const pages = await db.hostedPage.findMany({
    where: { isPublished: true },
    select: { slug: true, updatedAt: true, privacyPolicy: true, termsOfService: true },
  });

  const pageEntries: MetadataRoute.Sitemap = pages.flatMap((page) => {
    const entries: MetadataRoute.Sitemap = [
      {
        url: `${baseUrl}/p/${page.slug}`,
        lastModified: page.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      },
    ];
    if (page.privacyPolicy) {
      entries.push({
        url: `${baseUrl}/p/${page.slug}/privacy`,
        lastModified: page.updatedAt,
        changeFrequency: "monthly",
        priority: 0.3,
      });
    }
    if (page.termsOfService) {
      entries.push({
        url: `${baseUrl}/p/${page.slug}/terms`,
        lastModified: page.updatedAt,
        changeFrequency: "monthly",
        priority: 0.3,
      });
    }
    return entries;
  });

  // Approved apps
  const apps = await db.app.findMany({
    where: { isApproved: true },
    select: { id: true, updatedAt: true, hostedPageSlug: true },
  });

  const appEntries: MetadataRoute.Sitemap = apps
    .filter((app) => !app.hostedPageSlug) // skip apps that have hosted pages (already covered)
    .map((app) => ({
      url: `${baseUrl}/apps/${app.id}`,
      lastModified: app.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  return [...staticPages, ...pageEntries, ...appEntries];
}
