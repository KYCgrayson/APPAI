import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { auth } from "@/lib/auth";
import { AccountControls } from "./AccountControls";

export async function PlatformHeader() {
  const [t, session] = await Promise.all([getTranslations("common"), auth()]);

  return (
    <header className="border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="text-xl font-bold flex items-center gap-2 text-white">
          <img src="/appai-logo2.png" alt="AppAI" className="w-7 h-7 rounded" />
          AppAI
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/apps" className="hidden text-sm text-gray-400 transition-colors hover:text-white min-[400px]:inline">
            {t("browseApps")}
          </Link>
          <LanguageSwitcher />
          <AccountControls user={session?.user} labels={{ signIn: t("signIn"), dashboard: t("dashboard"), signOut: t("signOut"), account: t("account") }} light />
        </div>
      </div>
    </header>
  );
}
