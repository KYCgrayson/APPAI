import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { publicPageWhere, publicAppFilter, publicRootSelect } from "@/lib/hosted-page-visibility";
import { publisherLabel } from "@/lib/publisher-label";
import { chineseFallback } from "@/lib/zh-convert";
import { groupByKey, pickByLocale } from "@/lib/locale-match";
import { canLaunchUniversalApp, getUniversalAppLaunchPath } from "@/lib/universal-apps/directory";
import { appDirectoryKind, isPersonalDirectoryProfile, type DirectoryKind } from "@/lib/directory-kind";

const cacheOptions = { revalidate: 3600, tags: ["public-directory"] };
// Bound entries independently of catalog size. Content is used for classification
// on misses only; neither content nor raw Date-bearing Prisma rows enter the cache.
const DIRECTORY_BATCH_SIZE = 50;
const cardSelect = { id: true, name: true, tagline: true, category: true, logoUrl: true,
  iosUrl: true, androidUrl: true, hostedPageSlug: true, organizationId: true } as const;
const pageCardSelect = { organizationId: true, slug: true, locale: true, isDefault: true,
  title: true, tagline: true, canonicalUrl: true, template: true } as const;
const directoryAppSelect = { ...cardSelect, tags: true, appType: true, isApproved: true, url: true } as const;
function project<T, S extends Partial<Record<keyof T, true>>>(row: T, select: S): Pick<T, keyof S & keyof T> {
  return Object.fromEntries(Object.keys(select).map(key => [key, row[key as keyof T]])) as Pick<T, keyof S & keyof T>;
}

const loadDirectoryBatch = unstable_cache(async (
  locale: string, kind: DirectoryKind | null, activeCategory: string, personalOnly: boolean, offset: number,
) => {
  const roots = await db.hostedPage.findMany({ where: publicPageWhere(), select: publicRootSelect, orderBy: [{ slug: "asc" }, { locale: "asc" }] });
  const rows = await db.app.findMany({
    where: {
      ...publicAppFilter(roots),
      ...(activeCategory !== "ALL" ? { category: activeCategory } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: directoryAppSelect,
    skip: offset,
    take: DIRECTORY_BATCH_SIZE,
  });
  const apps = rows.map(row => project(row, directoryAppSelect));

  // Only published root pages enter the catalog. Draft variants never supply
  // either the classification or visible copy for a listing.
  const hostedSlugs = apps.map((app) => app.hostedPageSlug).filter((slug): slug is string => !!slug);
  const pageRows = hostedSlugs.length
    ? await db.hostedPage.findMany({
        where: { slug: { in: hostedSlugs }, ...publicPageWhere() },
        select: { ...pageCardSelect, content: true },
        orderBy: [{ slug: "asc" }, { locale: "asc" }],
      })
    : [];
  const hostedPages = pageRows.map(row => project(row, { ...pageCardSelect, content: true }));
  const variantsBySlug = groupByKey(hostedPages, (page) => `${page.organizationId}/${page.slug}`);
  const canonicalBySlug = new Map(
    hostedPages.filter((page) => page.isDefault).map((page) => [`${page.organizationId}/${page.slug}`, page.canonicalUrl]),
  );
  const allAppIds = apps.map((app) => app.id);
  const releases = allAppIds.length
    ? await db.appRelease.findMany({
        where: { appId: { in: allAppIds } },
        orderBy: { createdAt: "desc" },
        select: {
          appId: true,
          status: true,
          deployments: {
            where: { environment: "PRODUCTION" },
            orderBy: { createdAt: "desc" },
            select: { environment: true, status: true },
          },
        },
      })
    : [];
  const releasesByApp = groupByKey(releases, (release) => release.appId);

  const organizations = await db.organization.findMany({
    where: { id: { in: [...new Set([...apps.map(app => app.organizationId), ...hostedPages.map(page => page.organizationId)])] } },
    select: { id: true, name: true, users: { where: { role: "ADMIN" }, select: { role: true }, take: 1 } },
  });
  const publishers = new Map(organizations.map(org => [org.id, publisherLabel(org)]));
  const localizedVariant = (variants: typeof hostedPages) => {
    const cards = variants.map(variant => project(variant, pageCardSelect));
    return chineseFallback(cards, locale) ?? pickByLocale(cards, locale);
  };

  const directoryApps = apps.filter((app) => {
    if (personalOnly) return false;
    const variants = app.hostedPageSlug ? variantsBySlug.get(`${app.organizationId}/${app.hostedPageSlug}`) ?? [] : [];
    const pageKind = appDirectoryKind(app, variants);
    if (!pageKind) return false;
    if (!kind) return true;
    return pageKind === kind;
  });

  const personalProfiles = (!kind || (kind === "websites" && personalOnly))
    ? apps.map((app) => app.hostedPageSlug ? variantsBySlug.get(`${app.organizationId}/${app.hostedPageSlug}`) ?? [] : [])
      .filter(isPersonalDirectoryProfile)
      .map((variants) => localizedVariant(variants.filter((page) => page.template === "PERSON")))
      .filter((page) => page !== undefined)
    : [];
  return {
    entries: directoryApps.map(app => ({
      app: project(app, cardSelect),
      publisher: publishers.get(app.organizationId) ?? null,
      canonicalUrl: app.hostedPageSlug ? canonicalBySlug.get(`${app.organizationId}/${app.hostedPageSlug}`) ?? null : null,
      launchPath: canLaunchUniversalApp(app, releasesByApp.get(app.id)) ? getUniversalAppLaunchPath(app) : null,
      variant: app.hostedPageSlug ? localizedVariant(variantsBySlug.get(`${app.organizationId}/${app.hostedPageSlug}`) ?? []) ?? null : null,
    })),
    profiles: personalProfiles.map(profile => ({ ...profile, publisher: publishers.get(profile.organizationId) ?? null })),
    nextOffset: apps.length === DIRECTORY_BATCH_SIZE ? offset + DIRECTORY_BATCH_SIZE : null,
  };
}, ["public-directory-batch-v2"], cacheOptions);

export async function loadPublicDirectory(locale: string, kind?: DirectoryKind, category = "ALL", personalOnly = false) {
  const first = await loadDirectoryBatch(locale, kind ?? null, personalOnly ? "ALL" : category || "ALL", personalOnly, 0);
  const entries = [...first.entries];
  const profiles = [...first.profiles];
  let offset = first.nextOffset;
  while (offset !== null) {
    const batch = await loadDirectoryBatch(locale, kind ?? null, personalOnly ? "ALL" : category || "ALL", personalOnly, offset);
    entries.push(...batch.entries);
    profiles.push(...batch.profiles);
    offset = batch.nextOffset;
  }
  return { entries, profiles };
}

export const loadPublicHome = unstable_cache(async (locale: string) => {
  const roots = await db.hostedPage.findMany({ where: publicPageWhere(), select: publicRootSelect, orderBy: [{ slug: "asc" }, { locale: "asc" }] });
  const [featuredApps, recentApps, totalPages] = await Promise.all([
    db.app.findMany({
      where: { ...publicAppFilter(roots), isFeatured: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 6,
      select: cardSelect,
    }),
    db.app.findMany({
      where: publicAppFilter(roots),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 12,
      select: cardSelect,
    }),
    db.hostedPage.count({ where: publicPageWhere(roots) }),
  ]);

  // Same treatment as the directory: show each app's tagline in the visitor's
  // language when its hosted page was published in that language.
  const homeSlugs = [...featuredApps, ...recentApps]
    .map((a) => a.hostedPageSlug)
    .filter((s): s is string => !!s);
  const homeVariants = homeSlugs.length
    ? await db.hostedPage.findMany({
        where: { slug: { in: homeSlugs }, ...publicPageWhere() },
        select: { organizationId: true, slug: true, locale: true, isDefault: true, title: true, tagline: true },
        orderBy: [{ slug: "asc" }, { locale: "asc" }],
      })
    : [];
  const variantsBySlug = groupByKey(homeVariants.map(variant => project(variant, {
    organizationId: true, slug: true, locale: true, isDefault: true, title: true, tagline: true,
  })), h => `${h.organizationId}/${h.slug}`);
  const localize = (rows: typeof featuredApps) => rows.map(app => ({ ...project(app, cardSelect),
    localized: app.hostedPageSlug ? pickByLocale(variantsBySlug.get(`${app.organizationId}/${app.hostedPageSlug}`) ?? [], locale) : undefined }));
  return { featuredApps: localize(featuredApps), recentApps: localize(recentApps), totalPages };
}, ["public-directory-home-v1"], cacheOptions);

export const loadPublicAppDetail = unstable_cache(async (id: string, locale: string) => {
  const roots = await db.hostedPage.findMany({ where: publicPageWhere(), select: publicRootSelect, orderBy: [{ slug: "asc" }, { locale: "asc" }] });
  const select = { ...directoryAppSelect, description: true, screenshots: true } as const;
  const row = await db.app.findFirst({ where: { id, ...publicAppFilter(roots) }, select });
  if (!row) return null;
  const app = project(row, select);
  const variants = app.hostedPageSlug ? await db.hostedPage.findMany({
    where: { slug: app.hostedPageSlug, organizationId: app.organizationId, ...publicPageWhere() },
    select: { locale: true, isDefault: true, title: true, tagline: true, metaDescription: true, template: true, content: true },
    orderBy: [{ slug: "asc" }, { locale: "asc" }],
  }) : [];
  const localized = pickByLocale(variants.map(variant => project(variant, {
    locale: true, isDefault: true, title: true, tagline: true, metaDescription: true,
  })), locale) ?? null;
  const releases = app.appType ? await db.appRelease.findMany({
    where: { appId: app.id }, orderBy: { createdAt: "desc" },
    select: { status: true, deployments: { where: { environment: "PRODUCTION" }, orderBy: { createdAt: "desc" }, select: { environment: true, status: true } } },
  }) : [];
  // Classify on the miss; the breadcrumb needs only these JSON-safe results,
  // never the full published content or request/session data.
  return { app, localized, directoryKind: appDirectoryKind(app, variants),
    isPersonalProfile: isPersonalDirectoryProfile(variants), universalLaunchPath: canLaunchUniversalApp(app, releases) ? getUniversalAppLaunchPath(app) : null };
}, ["public-directory-detail-v2"], cacheOptions);
