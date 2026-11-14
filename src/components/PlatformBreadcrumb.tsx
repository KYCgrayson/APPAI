import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";

/** New page-content trails stay independent of the platform header's layout. */
export async function PlatformBreadcrumb({ section, items, dark = false }: {
  section?: "apps" | "websites" | "tools" | "games" | "feedback";
  items?: BreadcrumbItem[];
  dark?: boolean;
}) {
  const t = await getTranslations("breadcrumbs");
  const trail = items ?? (section ? [
    { name: "AppAI", href: "/" },
    { name: t(section), href: `/${section}` },
  ] : [{ name: "AppAI", href: "/" }]);
  return <Breadcrumb items={trail} label={t("label")} variant="platform" LinkComponent={Link} dark={dark} className="mb-6" />;
}
