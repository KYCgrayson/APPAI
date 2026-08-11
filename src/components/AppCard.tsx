import { getTranslations } from "next-intl/server";

/** The App fields a directory card renders. Kept structural so both the
 *  directory query and the home-page query satisfy it without a shared select. */
export type AppCardApp = {
  id: string;
  name: string;
  tagline: string;
  category: string;
  logoUrl: string | null;
  iosUrl: string | null;
  androidUrl: string | null;
};

export type AppCardProps = {
  app: AppCardApp;
  /** Where the card links. Callers own this: the directory routes Universal
   *  Apps to their launcher, the home page links to the hosted page. */
  href: string;
  /** Publisher name in the visitor's language — the hosted page's title for
   *  that locale. Falls back to `app.name` as submitted. */
  localizedName?: string | null;
  /** Publisher tagline in the visitor's language, when one was published.
   *  Falls back to `app.tagline` — the language the app was submitted in. */
  localizedTagline?: string | null;
  /** Set when this app launches an isolated Universal App runtime. */
  isUniversalApp?: boolean;
  /** Host of the external canonical, when the app points at its own domain. */
  canonicalHost?: string | null;
};

/**
 * One app in a directory grid. Used by `/[locale]/apps` and the home page.
 *
 * Name, tagline and category all follow the visitor's locale when the app
 * published a hosted page in that language (TODO.md D1).
 */
export async function AppCard({
  app,
  href,
  localizedName,
  localizedTagline,
  isUniversalApp = false,
  canonicalHost = null,
}: AppCardProps) {
  const t = await getTranslations("apps");

  const name = localizedName || app.name;

  // Categories are a fixed enum, but the release contract accepts any uppercase
  // value, so an unknown one must render rather than throw a missing-key error.
  const categoryLabel = t.has(`categories.${app.category}`)
    ? t(`categories.${app.category}`)
    : app.category;

  return (
    <a
      href={href}
      className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors block"
    >
      <div className="flex items-start gap-4">
        {app.logoUrl ? (
          // Logo URLs are app-supplied and not restricted to configured image hosts.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={app.logoUrl} alt={name} className="w-12 h-12 rounded-xl object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-lg font-bold text-gray-400">
            {name[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate text-white">{name}</h3>
          <p className="text-sm text-gray-400 line-clamp-2">{localizedTagline || app.tagline}</p>
          <div className="flex gap-2 mt-2 items-center flex-wrap">
            <span className="text-xs text-gray-600">{categoryLabel}</span>
            {app.iosUrl && <span className="text-xs text-blue-400">iOS</span>}
            {app.androidUrl && <span className="text-xs text-green-400">Android</span>}
            {isUniversalApp && (
              <>
                <span className="rounded border border-violet-600/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-violet-300">
                  {t("universalApp")}
                </span>
                <span className="text-[10px] text-cyan-300">{t("loginRequired")}</span>
              </>
            )}
            {canonicalHost && (
              <span
                className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-600/40 text-amber-400"
                title={`${t("landingPage")} — ${canonicalHost}`}
              >
                {t("landingPage")}
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
