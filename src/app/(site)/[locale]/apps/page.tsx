import { setRequestLocale } from "next-intl/server";
import { PlatformDirectory } from "@/components/PlatformDirectory";
import { platformMetadata } from "@/lib/platform-metadata";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props) {
  return platformMetadata(params, "apps");
}

// #92-E: publish/edit/unpublish refresh this via revalidateSeoIndexes();
// the one-day timer is only a safety net, so crawlers never re-query hourly.
export const revalidate = 86400;

export default async function DirectoryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlatformDirectory locale={locale} />;
}
