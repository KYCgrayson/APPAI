import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { AppCard } from "@/components/AppCard";
import { PlatformHeader } from "@/components/PlatformHeader";
import { getExternalCanonical } from "@/lib/canonical";
import { groupByKey, pickByLocale } from "@/lib/locale-match";
import { canLaunchUniversalApp, getUniversalAppLaunchPath } from "@/lib/universal-apps/directory";
import { UNIVERSAL_APP_CATEGORIES } from "@/lib/universal-apps/manifest";
import { getDirectoryCopy } from "@/lib/directory-copy";
import { inferDirectoryKind, type DirectoryKind } from "@/lib/directory-kind";
import { getProfileCopy, getPublishedProfiles } from "@/lib/people";

type Props = {
  kind?: DirectoryKind;
  category?: string;
};

export async function PlatformDirectory({ kind, category }: Props) {
  const [locale, appsT] = await Promise.all([getLocale(), getTranslations("apps")]);
  const copy = getDirectoryCopy(locale);
  const activeCategory = category || "ALL";
  const apps = await db.app.findMany({
    where: {
      isApproved: true,
      ...(activeCategory !== "ALL" ? { category: activeCategory } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Only published root pages enter the catalog. Draft variants never supply
  // either the classification or visible copy for a listing.
  const hostedSlugs = apps.map((app) => app.hostedPageSlug).filter((slug): slug is string => !!slug);
  const hostedPages = hostedSlugs.length
    ? await db.hostedPage.findMany({
        where: { slug: { in: hostedSlugs }, isPublished: true, parentSlug: null },
        select: {
          slug: true,
          locale: true,
          isDefault: true,
          title: true,
          tagline: true,
          canonicalUrl: true,
          template: true,
          content: true,
        },
      })
    : [];
  const variantsBySlug = groupByKey(hostedPages, (page) => page.slug);
  const canonicalBySlug = new Map(
    hostedPages.filter((page) => page.isDefault).map((page) => [page.slug, page.canonicalUrl]),
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

  const directoryApps = apps.filter((app) => {
    if (!kind) return true;
    const page = app.hostedPageSlug
      ? variantsBySlug.get(app.hostedPageSlug)?.find((candidate) => candidate.isDefault)
        ?? variantsBySlug.get(app.hostedPageSlug)?.[0]
      : undefined;
    if (!app.appType && app.hostedPageSlug && !page) return false;
    const content = page?.content as { sections?: Array<{ type?: string }> } | null;
    const pageKind = inferDirectoryKind({
      tags: app.tags,
      appType: app.appType,
      hostedPageSlug: app.hostedPageSlug,
      template: page?.template,
      sectionTypes: content?.sections?.map((section) => section.type ?? ""),
    });
    return pageKind === kind;
  });

  const categories = ["ALL", ...UNIVERSAL_APP_CATEGORIES];
  const categoryHref = (value: string) => {
    const path = kind === "websites" || kind === "tools" ? `/${kind}` : "/apps";
    const query = new URLSearchParams();
    if (kind === "apps") query.set("kind", "apps");
    if (value !== "ALL") query.set("category", value);
    const search = query.toString();
    return search ? `${path}?${search}` : path;
  };
  const categoryLabel = (value: string) =>
    appsT.has(`categories.${value}`) ? appsT(`categories.${value}`) : value;
  const personalProfiles = kind === "websites" && (activeCategory === "ALL" || activeCategory === "OTHER")
    ? getPublishedProfiles()
    : [];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PlatformHeader currentSection={kind ?? "apps"} />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-widest text-cyan-400">{copy.label}</p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            {kind ? copy.categories[kind] : copy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-gray-400">{kind ? copy.entrances[kind].description : copy.description}</p>
        </div>

        {kind === "websites" ? (
          <details open={activeCategory !== "ALL"} className="mb-8 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-300 marker:text-cyan-400">
              {copy.categoriesLabel}
            </summary>
            <nav aria-label={copy.categoriesLabel} className="mt-4 flex flex-wrap gap-2">
              {categories.map((value) => (
                <Link
                  key={value}
                  href={categoryHref(value)}
                  aria-current={activeCategory === value ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${activeCategory === value ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"}`}
                >
                  {value === "ALL" ? copy.all : categoryLabel(value)}
                </Link>
              ))}
            </nav>
          </details>
        ) : (
          <nav aria-label={copy.categoriesLabel} className="mb-8 flex flex-wrap gap-2">
            {categories.map((value) => (
              <Link
                key={value}
                href={categoryHref(value)}
                aria-current={activeCategory === value ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${activeCategory === value ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"}`}
              >
                {value === "ALL" ? copy.all : categoryLabel(value)}
              </Link>
            ))}
          </nav>
        )}

        {personalProfiles.length > 0 && (
          <section aria-label={copy.categories.websites} className="mb-10">
            <div className="grid gap-6 md:grid-cols-3">
              {personalProfiles.map((profile) => {
                const profileCopy = getProfileCopy(profile, locale);
                return (
                  <Link key={profile.handle} href={`/people/${profile.handle}`} className="block rounded-xl border border-gray-800 bg-gray-900 p-6 transition-colors hover:border-gray-700">
                    <p className="mb-2 text-xs uppercase tracking-wide text-cyan-400">{copy.personal}</p>
                    <h2 className="font-semibold text-white">{profileCopy.name}</h2>
                    <p className="mt-1 text-sm text-gray-400 line-clamp-2">{profileCopy.tagline}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {directoryApps.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-3">
            {directoryApps.map((app) => {
              const canonical = app.hostedPageSlug ? getExternalCanonical(canonicalBySlug.get(app.hostedPageSlug)) : null;
              const universalLaunchPath = canLaunchUniversalApp(app, releasesByApp.get(app.id)) ? getUniversalAppLaunchPath(app) : null;
              const variant = app.hostedPageSlug ? pickByLocale(variantsBySlug.get(app.hostedPageSlug) ?? [], locale) : undefined;
              return (
                <AppCard
                  key={app.id}
                  app={app}
                  href={universalLaunchPath ?? (app.hostedPageSlug ? `/p/${app.hostedPageSlug}` : `/apps/${app.id}`)}
                  localizedName={variant?.title}
                  localizedTagline={variant?.tagline}
                  isUniversalApp={!!universalLaunchPath}
                  canonicalHost={canonical?.host ?? null}
                />
              );
            })}
          </div>
        ) : personalProfiles.length === 0 ? (
          <div className="py-20 text-center">
            <h2 className="mb-2 text-xl font-semibold text-white">{copy.emptyTitle}</h2>
            <p className="text-gray-400">{copy.emptyDescription}</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
