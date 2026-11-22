import { getLocale, getTranslations } from "next-intl/server";
import { PlatformAccountControls } from "./PlatformAccountControls";
import { PlatformHeaderView, type PlatformHeaderViewProps } from "./PlatformHeaderView";
import { getDirectoryCopy } from "@/lib/directory-copy";
import { getGamesCopy } from "@/lib/games-catalog";
import { getGamePageLabels } from "@/lib/games-pages-copy";

export async function PlatformHeader({ currentSection, breadcrumbs, locale }: Pick<PlatformHeaderViewProps, "currentSection" | "breadcrumbs"> & { locale?: string }) {
  const t = await getTranslations("common");
  const accountLabels = { signIn: t("signIn"), dashboard: t("dashboard"), signOut: t("signOut"), account: t("account") };
  const resolvedLocale = locale ?? await getLocale();
  const copy = getDirectoryCopy(resolvedLocale);

  return (
    <PlatformHeaderView
      currentSection={currentSection}
      breadcrumbs={breadcrumbs}
      account={<PlatformAccountControls labels={accountLabels} compact={!!breadcrumbs} locale={locale} />}
      rememberLocale={locale !== undefined}
      labels={{
        categories: copy.categories,
        games: getGamesCopy(resolvedLocale).nav,
        breadcrumb: getGamePageLabels(resolvedLocale).breadcrumb,
      }}
    />
  );
}
