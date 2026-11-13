import { publicPageWhere, publicAppFilter, publicRootSelect } from "@/lib/hosted-page-visibility";
import { publisherLabel } from "@/lib/publisher-label";
import { chineseFallback, chineseScript } from "@/lib/zh-convert";
import { normalizeHostedContent } from "@/lib/hosted-content";
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

type Props = {
  kind?: DirectoryKind;
  category?: string;
  personalOnly?: boolean;
};

export async function PlatformDirectory({ kind, category, personalOnly = false }: Props) {
  const [locale, appsT] = await Promise.all([getLocale(), getTranslations("apps")]);
  const copy = getDirectoryCopy(locale);
  const activeCategory = personalOnly ? "ALL" : category || "ALL";
  const roots = await db.hostedPage.findMany({ where: publicPageWhere(), select: publicRootSelect, orderBy: [{ slug: "asc" }, { locale: "asc" }] });
  const apps = await db.app.findMany({
    where: {
      ...publicAppFilter(roots),
      ...(activeCategory !== "ALL" ? { category: activeCategory } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  // Only published root pages enter the catalog. Draft variants never supply
  // either the classification or visible copy for a listing.
  const hostedSlugs = apps.map((app) => app.hostedPageSlug).filter((slug): slug is string => !!slug);
  const hostedPages = hostedSlugs.length
    ? await db.hostedPage.findMany({
        where: { slug: { in: hostedSlugs }, ...publicPageWhere() },
        select: {
          organizationId: true,
          slug: true,
          locale: true,
          isDefault: true,
          title: true,
          tagline: true,
          canonicalUrl: true,
          template: true,
          content: true,
        },
        orderBy: [{ slug: "asc" }, { locale: "asc" }],
      })
    : [];
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
  const localizedVariant = (variants: typeof hostedPages) => chineseFallback(variants.map(({ content: _content, ...card }) => card), locale) ?? pickByLocale(variants, locale);

  const directoryApps = apps.filter((app) => {
    if (personalOnly) return false;
    const variants = app.hostedPageSlug ? variantsBySlug.get(`${app.organizationId}/${app.hostedPageSlug}`) ?? [] : [];
    // Games have their own catalog and /games/{slug} routes. A legacy tool/app
    // tag or download section must never put one back in these directories.
    if (app.tags.includes("appai:kind:game") || variants.some((page) => page.template === "GAME")) return false;
    if ((variants.find((page) => page.isDefault) ?? variants[0])?.template === "PERSON") return false;
    if (!kind) return true;
    const page = app.hostedPageSlug
      ? variantsBySlug.get(`${app.organizationId}/${app.hostedPageSlug}`)?.find((candidate) => candidate.isDefault)
        ?? variantsBySlug.get(`${app.organizationId}/${app.hostedPageSlug}`)?.[0]
      : undefined;
    if (!app.appType && app.hostedPageSlug && !page) return false;
    const content = normalizeHostedContent(page?.content);
    const pageKind = inferDirectoryKind({
      tags: app.tags,
      appType: app.appType,
      hostedPageSlug: app.hostedPageSlug,
      template: page?.template,
      content: page?.content,
      url: app.url,
      iosUrl: app.iosUrl,
      androidUrl: app.androidUrl,
      sectionTypes: content?.sections?.map((section) => section.type ?? ""),
    });
    return pageKind === kind;
  });

  const categories = ["ALL", ...UNIVERSAL_APP_CATEGORIES];
  const categoryHref = (value: string) => {
    const path = kind === "websites" || kind === "tools" ? `/${kind}` : "/apps";
    const query = new URLSearchParams();
    if (kind === "apps") query.set("kind", "apps");
    if (personalOnly) query.set("type", "personal");
    if (value !== "ALL") query.set("category", value);
    const search = query.toString();
    return search ? `${path}?${search}` : path;
  };
  const categoryLabel = (value: string) =>
    appsT.has(`categories.${value}`) ? appsT(`categories.${value}`) : value;
  const personalProfiles = (!kind || (kind === "websites" && personalOnly))
    ? apps.map((app) => app.hostedPageSlug ? variantsBySlug.get(`${app.organizationId}/${app.hostedPageSlug}`) ?? [] : [])
      .filter((variants) => (variants.find((page) => page.isDefault) ?? variants[0])?.template === "PERSON")
      .map((variants) => localizedVariant(variants.filter((page) => page.template === "PERSON")))
      .filter((page) => page !== undefined)
    : [];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PlatformHeader currentSection={kind ?? "apps"} />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-widest text-cyan-400">{copy.label}</p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            {personalOnly ? copy.personalPages : kind ? copy.categories[kind] : copy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-gray-400">{kind ? copy.entrances[kind].description : copy.description}</p>
        </div>

        <nav aria-label={copy.label} className="mb-4 flex min-w-0 flex-wrap gap-2">
          {[
            { label: copy.all, path: "/apps", active: !kind },
            { label: copy.categories.websites, path: "/websites", active: kind === "websites" && !personalOnly },
            { label: copy.categories.tools, path: "/tools", active: kind === "tools" },
            { label: copy.categories.apps, path: "/apps?kind=apps", active: kind === "apps" },
            { label: copy.personalPages, path: "/websites?type=personal", active: personalOnly },
          ].map(tab => (
            <Link key={tab.label} href={tab.path}
              aria-current={tab.active ? "page" : undefined}
              className={`rounded-full px-3 py-2 text-sm ${tab.active ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-300"}`}>
              {tab.label}
            </Link>
          ))}
        </nav>
        {!personalOnly && <details open={activeCategory !== "ALL"} className="mb-8 min-w-0 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-300">{copy.moreCategories}</summary>
          <nav aria-label={copy.categoriesLabel} className="mt-4 flex flex-wrap gap-2">
            {categories.map(value => (
              <Link key={value} href={categoryHref(value)} aria-current={activeCategory === value ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-sm ${activeCategory === value ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                {value === "ALL" ? copy.all : categoryLabel(value)}
              </Link>
            ))}
          </nav>
        </details>}

        {personalProfiles.length > 0 && (
          <section aria-label={copy.personalPages} className="mb-10">
            <div className="grid gap-6 md:grid-cols-3">
              {personalProfiles.map((profile) => {
                const hasLocale = profile.locale === locale;
                const href = `/p/${profile.slug}${hasLocale && !profile.isDefault ? `/${locale}` : ""}`;
                return (
                  <a key={profile.slug} href={href} className="block min-w-0 break-words rounded-xl border border-gray-800 bg-gray-900 p-6 transition-colors hover:border-gray-700">
                    <p className="mb-2 text-xs uppercase tracking-wide text-cyan-400">{copy.personal}</p>
                    {publishers.get(profile.organizationId) && <p className="mb-2 text-xs text-gray-400 break-words">{copy.by} {publishers.get(profile.organizationId)}</p>}
                    <h2 className="font-semibold text-white">{profile.title}</h2>
                    <p className="mt-1 text-sm text-gray-400 line-clamp-2">{profile.tagline}</p>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {directoryApps.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-3">
            {directoryApps.map((app) => {
              const canonical = app.hostedPageSlug ? getExternalCanonical(canonicalBySlug.get(`${app.organizationId}/${app.hostedPageSlug}`)) : null;
              const universalLaunchPath = canLaunchUniversalApp(app, releasesByApp.get(app.id)) ? getUniversalAppLaunchPath(app) : null;
              const variant = app.hostedPageSlug ? localizedVariant(variantsBySlug.get(`${app.organizationId}/${app.hostedPageSlug}`) ?? []) : undefined;
              return (
                <AppCard
                  key={app.id}
                  app={app}
                  publisherLabel={publishers.get(app.organizationId)}
                  publisherPrefix={copy.by}
                  href={universalLaunchPath ?? (app.hostedPageSlug ? `/p/${app.hostedPageSlug}${chineseScript(locale) && variant?.locale === locale && !variant.isDefault ? `/${locale}` : ""}` : `/apps/${app.id}`)}
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
