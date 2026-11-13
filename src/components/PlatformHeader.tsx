import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { PlatformHeaderView, type PlatformHeaderViewProps } from "./PlatformHeaderView";
import { getDirectoryCopy } from "@/lib/directory-copy";
import { getGamesCopy } from "@/lib/games-catalog";
import { getGamePageLabels } from "@/lib/games-pages-copy";

export async function PlatformHeader({ currentSection, breadcrumbs }: Pick<PlatformHeaderViewProps, "currentSection" | "breadcrumbs">) {
  const [t, session, locale] = await Promise.all([getTranslations("common"), auth(), getLocale()]);
  const copy = getDirectoryCopy(locale);

  return (
    <PlatformHeaderView
      currentSection={currentSection}
      breadcrumbs={breadcrumbs}
      user={session?.user}
      isAdmin={((session as unknown as { role?: string })?.role ?? "USER") === "ADMIN"}
      labels={{
        account: { signIn: t("signIn"), dashboard: t("dashboard"), signOut: t("signOut"), account: t("account") },
        categories: copy.categories,
        games: getGamesCopy(locale).nav,
        breadcrumb: getGamePageLabels(locale).breadcrumb,
      }}
    />
  );
}
