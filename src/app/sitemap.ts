import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { buildPagePath } from "@/lib/parse-page-segments";
import { locales } from "@/i18n/routing";

// ISR: regenerate at most once per hour; on publish/update, call
// revalidatePath('/sitemap.xml') to push fresh entries sooner.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";

  // Static pages with locale alternates
  const staticPaths = [
    { path: "", changeFrequency: "daily" as const, priority: 1 },
    { path: "/apps", changeFrequency: "daily" as const, priority: 0.8 },
    { path: "/websites", changeFrequency: "daily" as const, priority: 0.8 },
    { path: "/tools", changeFrequency: "daily" as const, priority: 0.8 },
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

  // Published hosted pages (all locales). On local builds without a real
  // Postgres (ALLOW_LOCAL_HTTP_BACKEND=1) fall back to none instead of
  // failing the build; production keeps failing loudly.
  let pages: {
    slug: string;
    parentSlug: string | null;
    locale: string;
    isDefault: boolean;
    updatedAt: Date;
    privacyPolicy: string | null;
    termsOfService: string | null;
  }[] = [];
  try {
    pages = await db.hostedPage.findMany({
      where: { isPublished: true },
      select: { slug: true, parentSlug: true, locale: true, isDefault: true, updatedAt: true, privacyPolicy: true, termsOfService: true },
    });
  } catch (e) {
    if (process.env.ALLOW_LOCAL_HTTP_BACKEND !== "1") throw e;
  }

  const publishedRoots = new Set(pages.filter(page => !page.parentSlug).map(page => page.slug));
  pages = pages.filter(page => !page.parentSlug || publishedRoots.has(page.parentSlug));

  // Group pages by slug to build hreflang alternates
  const pageKey = (page: typeof pages[number]) => `${page.parentSlug || ""}/${page.slug}`;
  const hostedPath = (page: typeof pages[number], locale: string, isDefault: boolean) =>
    buildPagePath(page.parentSlug || page.slug, locale, page.parentSlug ? page.slug : null, isDefault);
  const slugGroups = new Map<string, typeof pages>();
  for (const page of pages) {
    const group = slugGroups.get(pageKey(page)) || [];
    group.push(page);
    slugGroups.set(pageKey(page), group);
  }

  const pageEntries: MetadataRoute.Sitemap = pages.flatMap((page) => {
    const siblings = slugGroups.get(pageKey(page)) || [];

    // Build hreflang alternates for this slug
    const languages: Record<string, string> = {};
    for (const sibling of siblings) {
      languages[sibling.locale] = `${baseUrl}${hostedPath(page, sibling.locale, sibling.isDefault)}`;
    }
    const defaultSibling = siblings.find((s) => s.isDefault) || siblings[0];
    if (defaultSibling) {
      languages["x-default"] = `${baseUrl}${hostedPath(page, defaultSibling.locale, true)}`;
    }

    const entries: MetadataRoute.Sitemap = [
      {
        url: `${baseUrl}${hostedPath(page, page.locale, page.isDefault)}`,
        lastModified: page.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: { languages },
      },
    ];
    // Build hreflang alternates for privacy/terms subpages — only include
    // locales whose sibling row actually has the corresponding policy set.
    if (page.parentSlug) return entries; // Legacy policy subpages belong to roots.
    const privacyLangs: Record<string, string> = {};
    const termsLangs: Record<string, string> = {};
    for (const sibling of siblings) {
      if ((sibling as typeof page).privacyPolicy) {
        privacyLangs[sibling.locale] = `${baseUrl}${buildPagePath(page.slug, sibling.locale, "privacy", sibling.isDefault)}`;
      }
      if ((sibling as typeof page).termsOfService) {
        termsLangs[sibling.locale] = `${baseUrl}${buildPagePath(page.slug, sibling.locale, "terms", sibling.isDefault)}`;
      }
    }
    const privacyDefault = siblings.find((s) => s.isDefault && (s as typeof page).privacyPolicy);
    if (privacyDefault) {
      privacyLangs["x-default"] = `${baseUrl}${buildPagePath(page.slug, privacyDefault.locale, "privacy", true)}`;
    }
    const termsDefault = siblings.find((s) => s.isDefault && (s as typeof page).termsOfService);
    if (termsDefault) {
      termsLangs["x-default"] = `${baseUrl}${buildPagePath(page.slug, termsDefault.locale, "terms", true)}`;
    }

    if (page.privacyPolicy) {
      entries.push({
        url: `${baseUrl}${buildPagePath(page.slug, page.locale, "privacy", page.isDefault)}`,
        lastModified: page.updatedAt,
        changeFrequency: "monthly",
        priority: 0.3,
        alternates: Object.keys(privacyLangs).length > 1 ? { languages: privacyLangs } : undefined,
      });
    }
    if (page.termsOfService) {
      entries.push({
        url: `${baseUrl}${buildPagePath(page.slug, page.locale, "terms", page.isDefault)}`,
        lastModified: page.updatedAt,
        changeFrequency: "monthly",
        priority: 0.3,
        alternates: Object.keys(termsLangs).length > 1 ? { languages: termsLangs } : undefined,
      });
    }
    return entries;
  });

  // Approved apps (with locale alternates). Same local-build fallback.
  let apps: { id: string; updatedAt: Date; hostedPageSlug: string | null }[] =
    [];
  try {
    apps = await db.app.findMany({
      where: { isApproved: true },
      select: { id: true, updatedAt: true, hostedPageSlug: true },
    });
  } catch (e) {
    if (process.env.ALLOW_LOCAL_HTTP_BACKEND !== "1") throw e;
  }

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
