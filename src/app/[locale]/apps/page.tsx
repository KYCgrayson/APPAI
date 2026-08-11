export const dynamic = "force-dynamic";

import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { AppCard } from "@/components/AppCard";
import { PlatformHeader } from "@/components/PlatformHeader";
import { getExternalCanonical } from "@/lib/canonical";
import { groupByKey, pickByLocale } from "@/lib/locale-match";
import { canLaunchUniversalApp, getUniversalAppLaunchPath } from "@/lib/universal-apps/directory";
import { UNIVERSAL_APP_CATEGORIES } from "@/lib/universal-apps/manifest";

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [t, locale] = await Promise.all([getTranslations("apps"), getLocale()]);
  const { category } = await searchParams;
  const activeCategory = category || "ALL";

  const apps = await db.app.findMany({
    where: {
      isApproved: true,
      ...(activeCategory !== "ALL" ? { category: activeCategory } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  const directoryApps = apps;

  // Every locale variant, not just the default one: an app that published a
  // page in the visitor's language already has a tagline written in it, and the
  // directory is where that copy is worth showing. One query either way.
  const hostedSlugs = directoryApps.map((a) => a.hostedPageSlug).filter((s): s is string => !!s);
  const hostedPages = hostedSlugs.length
    ? await db.hostedPage.findMany({
        where: { slug: { in: hostedSlugs } },
        select: {
          slug: true,
          locale: true,
          isDefault: true,
          isPublished: true,
          title: true,
          tagline: true,
          canonicalUrl: true,
        },
      })
    : [];
  // Draft variants keep their canonical behaviour but must not leak unpublished
  // copy into the directory.
  const variantsBySlug = groupByKey(
    hostedPages.filter((h) => h.isPublished),
    (h) => h.slug,
  );
  // The canonical stays on the default row so per-locale variants never move it.
  const canonicalBySlug = new Map(
    hostedPages.filter((h) => h.isDefault).map((h) => [h.slug, h.canonicalUrl]),
  );

  // Approved is not the same as deployed. Ask the same question the launcher
  // asks, so a card never advertises a launch that ends on an error page.
  const universalAppIds = directoryApps.filter((a) => a.appType).map((a) => a.id);
  const releases = universalAppIds.length
    ? await db.appRelease.findMany({
        where: { appId: { in: universalAppIds } },
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
  const releasesByApp = groupByKey(releases, (r) => r.appId);

  const categories = ["ALL", ...UNIVERSAL_APP_CATEGORIES];
  const categoryLabel = (cat: string) =>
    t.has(`categories.${cat}`) ? t(`categories.${cat}`) : cat;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PlatformHeader />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-8 text-white">{t("title")}</h1>

        <div className="flex gap-2 flex-wrap mb-8">
          {categories.map((cat) => (
            <Link
              key={cat}
              href={cat === "ALL" ? "/apps" : `/apps?category=${cat}`}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                activeCategory === cat
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              {categoryLabel(cat)}
            </Link>
          ))}
        </div>

        {directoryApps.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold mb-2 text-white">{t("noAppsTitle")}</h2>
            <p className="text-gray-400">
              {activeCategory !== "ALL"
                ? t("noAppsCategory", { category: categoryLabel(activeCategory) })
                : t("noAppsDefault")}
            </p>
          </div>
        ) : directoryApps.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-6">
            {directoryApps.map((app) => {
              const canonical = app.hostedPageSlug
                ? getExternalCanonical(canonicalBySlug.get(app.hostedPageSlug))
                : null;
              const universalLaunchPath = canLaunchUniversalApp(app, releasesByApp.get(app.id))
                ? getUniversalAppLaunchPath(app)
                : null;
              const variant = app.hostedPageSlug
                ? pickByLocale(variantsBySlug.get(app.hostedPageSlug) ?? [], locale)
                : undefined;
              return (
                <AppCard
                  key={app.id}
                  app={app}
                  href={
                    universalLaunchPath ??
                    (app.hostedPageSlug ? `/p/${app.hostedPageSlug}` : `/apps/${app.id}`)
                  }
                  localizedName={variant?.title}
                  localizedTagline={variant?.tagline}
                  isUniversalApp={!!universalLaunchPath}
                  canonicalHost={canonical?.host ?? null}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
