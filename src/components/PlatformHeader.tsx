import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { auth } from "@/lib/auth";
import { AccountControls } from "./AccountControls";
import { getDirectoryCopy } from "@/lib/directory-copy";

export async function PlatformHeader({ currentSection }: { currentSection?: "websites" | "tools" | "apps" }) {
  const [t, session, locale] = await Promise.all([getTranslations("common"), auth(), getLocale()]);
  const copy = getDirectoryCopy(locale);

  return (
    <header className="border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="text-xl font-bold flex items-center gap-2 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- Small same-origin brand mark; keep the shared header independent of image optimization configuration. */}
          <img src="/appai-logo2.png" alt="AppAI" className="w-7 h-7 rounded" />
          AppAI
        </Link>
        <div className="order-2 flex shrink-0 items-center gap-2 sm:order-3 sm:gap-3">
          <LanguageSwitcher />
          <AccountControls user={session?.user} isAdmin={((session as unknown as { role?: string })?.role ?? "USER") === "ADMIN"} labels={{ signIn: t("signIn"), dashboard: t("dashboard"), signOut: t("signOut"), account: t("account") }} light />
        </div>
        <nav aria-label="Main navigation" className="order-3 basis-full border-t border-gray-800 pt-2 sm:order-2 sm:basis-auto sm:border-0 sm:pt-0">
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
          </ul>
        </nav>
      </div>
    </header>
  );
}
