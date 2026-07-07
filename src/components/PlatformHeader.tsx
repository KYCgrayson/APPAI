import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function PlatformHeader() {
  const t = await getTranslations("common");

  return (
    <header className="border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold flex items-center gap-2 text-white">
          <img src="/appai-logo2.png" alt="AppAI" className="w-7 h-7 rounded" />
          AppAI
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/apps" className="text-sm text-gray-400 hover:text-white transition-colors">
            {t("browseApps")}
          </Link>
          <LanguageSwitcher />
          <a
            href="/dashboard"
            className="text-sm bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-500 transition-colors"
          >
            {t("dashboard")}
          </a>
        </div>
      </div>
    </header>
  );
}
