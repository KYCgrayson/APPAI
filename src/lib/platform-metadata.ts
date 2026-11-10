import { getTranslations } from "next-intl/server";
import { buildPlatformMetadata } from "./platform-seo";

export async function platformMetadata(
  params: Promise<{ locale: string }>,
  page: "home" | "tools" | "apps" | "websites",
) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: `seo.${page}` });
  return buildPlatformMetadata(locale, page === "home" ? "/" : `/${page}`, {
    title: t("title"), description: t("description"),
  });
}
