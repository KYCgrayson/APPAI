import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { PlatformHeaderView, type PlatformHeaderViewProps } from "./PlatformHeaderView";

export async function PlatformHeader({ currentSection, breadcrumbs, pageLabel }: Pick<PlatformHeaderViewProps, "currentSection" | "breadcrumbs"> & {
  pageLabel?: "signIn" | "signOut" | "feedback" | "deviceAuth";
}) {
  const [t, session] = await Promise.all([getTranslations("common"), auth()]);
  const tb = await getTranslations("breadcrumbs");
  const trail = breadcrumbs?.map(item => ["/apps", "/websites", "/tools", "/games"].includes(item.href)
    ? { ...item, name: tb(item.href.slice(1)) } : item) ?? (currentSection ? [
    { name: "AppAI", href: "/" }, { name: tb(currentSection), href: `/${currentSection}` },
  ] : pageLabel ? [
    { name: "AppAI", href: "/" }, { name: tb(pageLabel), href: { signIn: "/login", signOut: "/logout", feedback: "/feedback", deviceAuth: "/auth/device" }[pageLabel] },
  ] : undefined);

  return (
    <PlatformHeaderView
      currentSection={currentSection}
      breadcrumbs={trail}
      showNavigation={!breadcrumbs && !!currentSection}
      user={session?.user}
      isAdmin={((session as unknown as { role?: string })?.role ?? "USER") === "ADMIN"}
      labels={{
        account: { signIn: t("signIn"), dashboard: t("dashboard"), signOut: t("signOut"), account: t("account") },
        categories: { apps: tb("apps"), websites: tb("websites"), tools: tb("tools") },
        games: tb("games"),
        breadcrumb: tb("label"),
      }}
    />
  );
}
