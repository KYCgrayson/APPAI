import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { PlatformHeaderView, type PlatformHeaderViewProps } from "./PlatformHeaderView";
import { getDirectoryCopy } from "@/lib/directory-copy";
import { getGamesCopy } from "@/lib/games-catalog";

export async function PlatformHeader({ currentSection, breadcrumbs }: Pick<PlatformHeaderViewProps, "currentSection" | "breadcrumbs">) {
  const [t, session, locale] = await Promise.all([getTranslations("common"), auth(), getLocale()]);
  const copy = getDirectoryCopy(locale);
  const tb = await getTranslations("breadcrumbs");

  return (
    <PlatformHeaderView
      currentSection={currentSection}
      breadcrumbs={breadcrumbs?.map((item, index) => index === 1 ? { ...item, name: tb("games") } : item)}
      user={session?.user}
      isAdmin={((session as unknown as { role?: string })?.role ?? "USER") === "ADMIN"}
      labels={{
        account: { signIn: t("signIn"), dashboard: t("dashboard"), signOut: t("signOut"), account: t("account") },
        categories: copy.categories,
        games: getGamesCopy(locale).nav,
        breadcrumb: tb("label"),
      }}
    />
  );
}
