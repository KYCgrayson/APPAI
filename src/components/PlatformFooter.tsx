import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function PlatformFooter() {
  const t = await getTranslations("common");
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
    || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
    || "dev";

  return (
    <footer className="border-t border-gray-800 py-8 px-6 bg-gray-950">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <div>{t("footerTagline")}</div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/apps" className="hover:text-gray-300 transition-colors">
            {t("browse")}
          </Link>
          <a href="/spec" className="hover:text-gray-300 transition-colors">
            {t("agentSpec")}
          </a>
          <a href="https://github.com/KYCgrayson/APPAI" target="_blank" className="hover:text-gray-300 transition-colors">
            {t("github")}
          </a>
          <a href="https://github.com/KYCgrayson/APPAI/issues" target="_blank" className="hover:text-gray-300 transition-colors">
            {t("feedback")}
          </a>
          <a href="/dashboard" className="hover:text-gray-300 transition-colors">
            {t("dashboard")}
          </a>
          <span className="text-gray-300 font-mono text-xs" title={`Build: ${commitSha}`}>
            v{commitSha}
          </span>
        </div>
      </div>
    </footer>
  );
}
