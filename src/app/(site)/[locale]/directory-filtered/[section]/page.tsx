import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PlatformDirectory } from "@/components/PlatformDirectory";
import { DIRECTORY_KINDS, type DirectoryKind } from "@/lib/directory-kind";
import { platformMetadata } from "@/lib/platform-metadata";

type Props = {
  params: Promise<{ locale: string; section: DirectoryKind }>;
  searchParams: Promise<{ category?: string; kind?: string; type?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, section } = await params;
  if (!DIRECTORY_KINDS.includes(section)) notFound();
  return platformMetadata(Promise.resolve({ locale }), section);
}

export const dynamic = "force-dynamic";

export default async function FilteredDirectoryPage({ params, searchParams }: Props) {
  const { locale, section } = await params;
  if (!DIRECTORY_KINDS.includes(section)) notFound();
  setRequestLocale(locale);

  const { category, kind: requestedKind, type } = await searchParams;
  const kind = section === "apps"
    ? DIRECTORY_KINDS.find(kind => kind === requestedKind)
    : section;
  return <PlatformDirectory locale={locale} kind={kind} category={category} personalOnly={section === "websites" && type === "personal"} />;
}
