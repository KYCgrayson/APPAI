import { loadPublicDirectory } from "@/lib/public-directory";
import type { DirectoryKind } from "@/lib/directory-kind";
import { chineseScript } from "@/lib/zh-convert";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AppCard } from "@/components/AppCard";
import { PlatformHeader } from "@/components/PlatformHeader";
import { PlatformBreadcrumb } from "@/components/PlatformBreadcrumb";
import { getExternalCanonical } from "@/lib/canonical";
import { UNIVERSAL_APP_CATEGORIES } from "@/lib/universal-apps/manifest";
import { getDirectoryCopy } from "@/lib/directory-copy";

type Props = {
  kind?: DirectoryKind;
  category?: string;
  personalOnly?: boolean;
};

export async function PlatformDirectory({ kind, category, personalOnly = false }: Props) {
  const [locale, appsT] = await Promise.all([getLocale(), getTranslations("apps")]);
  const copy = getDirectoryCopy(locale);
  const activeCategory = personalOnly ? "ALL" : category || "ALL";
  const { entries, profiles: personalProfiles } = await loadPublicDirectory(locale, kind, activeCategory, personalOnly);

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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PlatformHeader currentSection={kind ?? "apps"} />
      <main className="max-w-6xl mx-auto px-6 pt-4 pb-8">
        <PlatformBreadcrumb section={kind ?? "apps"} dark />
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
                    {profile.publisher && <p className="mb-2 text-xs text-gray-400 break-words">{copy.by} {profile.publisher}</p>}
                    <h2 className="font-semibold text-white">{profile.title}</h2>
                    <p className="mt-1 text-sm text-gray-400 line-clamp-2">{profile.tagline}</p>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {entries.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-3">
            {entries.map(({ app, canonicalUrl, launchPath: universalLaunchPath, variant, publisher }) => {
              const canonical = getExternalCanonical(canonicalUrl);
              return (
                <AppCard
                  key={app.id}
                  app={app}
                  publisherLabel={publisher ?? undefined}
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
