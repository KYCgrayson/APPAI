import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function PlatformHeader() {
  const t = await getTranslations("common");

  return (
    <header className="border-b">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold flex items-center gap-2">
          <img src="/appai-logo2.png" alt="AppAI" className="w-7 h-7 rounded" />
          AppAI
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/apps" className="text-sm text-gray-600 hover:text-black">
            {t("browseApps")}
          </Link>
          <LanguageSwitcher />
          <a
            href="/dashboard"
            className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            {t("dashboard")}
          </a>
        </div>
      </div>
    </header>
  );
}
