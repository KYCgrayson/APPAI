import { setRequestLocale } from "next-intl/server";
import { PlatformDirectory } from "@/components/PlatformDirectory";
import { platformMetadata } from "@/lib/platform-metadata";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props) {
  return platformMetadata(params, "websites");
}

export const revalidate = 3600;

export default async function DirectoryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlatformDirectory locale={locale} kind="websites" />;
}
