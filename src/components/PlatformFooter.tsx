import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getGamePageLabels } from "@/lib/games-pages-copy";

export async function PlatformFooter({ gameNavigation = false }: { gameNavigation?: boolean }) {
  const t = await getTranslations("common");
  const labels = getGamePageLabels(await getLocale());
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
    || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
    || "dev";

  return (
    <footer className="border-t border-gray-800 py-8 px-6 bg-gray-950">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <div>{t("footerTagline")}</div>
        <div className="flex flex-wrap justify-center gap-4">
          {gameNavigation && <>
            <Link href="/" className="inline-flex min-h-11 items-center hover:text-gray-300">{labels.home}</Link>
            <Link href="/games" className="inline-flex min-h-11 items-center hover:text-gray-300">{labels.allGames}</Link>
            <NextLink href="/spec" prefetch={false} className="inline-flex min-h-11 items-center hover:text-gray-300">{labels.docs}</NextLink>
            <a href="#game-faq" className="inline-flex min-h-11 items-center hover:text-gray-300">{labels.faqLink}</a>
          </>}
          {!gameNavigation && <>
            <Link href="/apps" className="hover:text-gray-300 transition-colors">
              {t("browse")}
            </Link>
            <NextLink href="/spec" prefetch={false} className="hover:text-gray-300 transition-colors">
              {t("agentSpec")}
            </NextLink>
            <a href="https://github.com/KYCgrayson/APPAI" target="_blank" className="hover:text-gray-300 transition-colors">
              {t("github")}
            </a>
            <Link href="/feedback" className="hover:text-gray-300 transition-colors">
              {t("feedback")}
            </Link>
            <NextLink href="/dashboard" prefetch={false} className="hover:text-gray-300 transition-colors">
              {t("dashboard")}
            </NextLink>
          </>}
          <span className="text-gray-300 font-mono text-xs" title={`Build: ${commitSha}`}>
            v{commitSha}
          </span>
        </div>
      </div>
    </footer>
  );
}
