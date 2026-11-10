import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { auth } from "@/lib/auth";
import { AccountControls } from "./AccountControls";
import { getDirectoryCopy } from "@/lib/directory-copy";
import { getGamesCopy } from "@/lib/games-catalog";
import { getGamePageLabels } from "@/lib/games-pages-copy";

export async function PlatformHeader({ currentSection, breadcrumbs }: {
  currentSection?: "websites" | "tools" | "apps" | "games";
  breadcrumbs?: { name: string; href: string }[];
}) {
  const [t, session, locale] = await Promise.all([getTranslations("common"), auth(), getLocale()]);
  const copy = getDirectoryCopy(locale);

  return (
    <header className="border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        <div className={breadcrumbs ? "flex min-w-0 flex-1 items-center gap-3" : "contents"}>
          <Link href="/" className="text-xl font-bold flex shrink-0 items-center gap-2 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- Small same-origin brand mark; keep the shared header independent of image optimization configuration. */}
            <img src="/appai-logo2.png" alt="AppAI" className="w-7 h-7 rounded" />
            {!breadcrumbs && <span>AppAI</span>}
          </Link>
          {breadcrumbs && (
            <nav aria-label={getGamePageLabels(locale).breadcrumb} className="min-w-0 text-sm text-gray-300">
              <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                {breadcrumbs.map(({ name, href }, index) => (
                  <li key={href} className="flex min-w-0 items-center gap-1.5">
                    {index > 0 && <span aria-hidden="true" className="text-gray-500">›</span>}
                    <Link href={href} aria-current={index === breadcrumbs.length - 1 ? "page" : undefined} className="min-w-0 break-words hover:text-white hover:underline">{name}</Link>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </div>
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3 sm:gap-3">
          <LanguageSwitcher />
          <AccountControls user={session?.user} isAdmin={((session as unknown as { role?: string })?.role ?? "USER") === "ADMIN"} labels={{ signIn: t("signIn"), dashboard: t("dashboard"), signOut: t("signOut"), account: t("account") }} light />
        </div>
        {!breadcrumbs && <nav aria-label="Main navigation" className="order-3 basis-full border-t border-gray-800 pt-2 sm:order-2 sm:basis-auto sm:border-0 sm:pt-0">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {(["websites", "tools", "apps"] as const).map((section) => (
              <li key={section}>
                <Link
                  href={section === "apps" ? "/apps?kind=apps" : `/${section}`}
                  aria-current={currentSection === section ? "page" : undefined}
                  className={`text-sm transition-colors hover:text-white ${currentSection === section ? "text-cyan-300" : "text-gray-400"}`}
                >
                  {copy.categories[section]}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/games"
                aria-current={currentSection === "games" ? "page" : undefined}
                className={`text-sm transition-colors hover:text-white ${currentSection === "games" ? "text-cyan-300" : "text-gray-400"}`}
              >
                {getGamesCopy(locale).nav}
              </Link>
            </li>
          </ul>
        </nav>}
      </div>
    </header>
  );
}
