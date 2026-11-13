import { Link } from "@/i18n/navigation";
import { AccountControls, type AccountLabels, type AccountUser } from "./AccountControls";
import { Breadcrumb } from "./Breadcrumb";
import { LanguageSwitcher } from "./LanguageSwitcher";

export type PlatformHeaderViewProps = {
  currentSection?: "websites" | "tools" | "apps" | "games";
  breadcrumbs?: { name: string; href: string }[];
  showNavigation?: boolean;
  user?: AccountUser | null;
  isAdmin?: boolean;
  labels: {
    account: AccountLabels;
    categories: Record<"websites" | "tools" | "apps", string>;
    games: string;
    breadcrumb: string;
  };
};

/** Shared presentation, with identity and translated copy supplied by the caller. */
export function PlatformHeaderView({ currentSection, breadcrumbs, showNavigation, user, isAdmin, labels }: PlatformHeaderViewProps) {
  return (
    <>
    <header className="border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="text-xl font-bold flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- Small same-origin brand mark; keep the shared header independent of image optimization configuration. */}
          <img src="/appai-logo2.png" alt="AppAI" className="w-7 h-7 rounded" />
          {!breadcrumbs && <span>AppAI</span>}
        </Link>
        <div className={breadcrumbs
          ? "order-2 ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:order-3 sm:flex-none sm:gap-3"
          : "order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3 sm:gap-3"}>
          <LanguageSwitcher compact={!!breadcrumbs} />
          <AccountControls user={user} isAdmin={isAdmin} labels={labels.account} compact={!!breadcrumbs} light />
        </div>
        {(!breadcrumbs || showNavigation) && (
          <nav aria-label="Main navigation" className="order-3 basis-full border-t border-gray-800 pt-2 sm:order-2 sm:basis-auto sm:border-0 sm:pt-0">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {(["websites", "tools", "apps"] as const).map((section) => (
                <li key={section}>
                  <Link
                    href={section === "apps" ? "/apps?kind=apps" : `/${section}`}
                    aria-current={currentSection === section ? "page" : undefined}
                    className={`text-sm transition-colors hover:text-white ${currentSection === section ? "text-cyan-300" : "text-gray-400"}`}
                  >
                    {labels.categories[section]}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/games"
                  aria-current={currentSection === "games" ? "page" : undefined}
                  className={`text-sm transition-colors hover:text-white ${currentSection === "games" ? "text-cyan-300" : "text-gray-400"}`}
                >
                  {labels.games}
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
    {breadcrumbs && <Breadcrumb items={breadcrumbs} label={labels.breadcrumb} variant="platform" LinkComponent={Link} dark
      className="px-4 py-2 sm:px-6 [&>ol]:mx-auto [&>ol]:w-full [&>ol]:max-w-6xl" />}
    </>
  );
}
