import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function PlatformFooter() {
  const t = await getTranslations("common");

  return (
    <footer className="border-t py-8 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-500">
        <div>{t("footerTagline")}</div>
        <div className="flex gap-4">
          <Link href="/apps" className="hover:text-black">
            {t("browse")}
          </Link>
          <a href="/spec" className="hover:text-black">
            {t("agentSpec")}
          </a>
          <a href="https://github.com/KYCgrayson/APPAI" target="_blank" className="hover:text-black">
            {t("github")}
          </a>
          <a href="/dashboard" className="hover:text-black">
            {t("dashboard")}
          </a>
        </div>
      </div>
    </footer>
  );
}
