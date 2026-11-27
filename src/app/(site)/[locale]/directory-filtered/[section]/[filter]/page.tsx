import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PlatformDirectory } from "@/components/PlatformDirectory";
import { directoryFilter, directoryKind } from "@/lib/directory-filter";
import { platformMetadata } from "@/lib/platform-metadata";

type Props = {
  params: Promise<{ locale: string; section: string; filter: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, section: segment, filter } = await params;
  const section = directoryKind(segment);
  if (!section || !directoryFilter(section, filter)) notFound();
  return platformMetadata(Promise.resolve({ locale }), section);
}

// #92-E: publish/edit/unpublish refresh this via revalidateSeoIndexes();
// the one-day timer is only a safety net, so crawlers never re-query hourly.
export const revalidate = 86400;

// Middleware and directoryFilter bound the paths that can generate on demand.
export function generateStaticParams() {
  return [];
}

export default async function FilteredDirectoryPage({ params }: Props) {
  const { locale, section: segment, filter } = await params;
  const section = directoryKind(segment);
  const filters = section && directoryFilter(section, filter);
  if (!filters) notFound();
  setRequestLocale(locale);

  return <PlatformDirectory locale={locale} {...filters} />;
}
