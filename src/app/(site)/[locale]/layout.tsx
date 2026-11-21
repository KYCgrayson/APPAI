import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { RootDocument, rootMetadata } from "../../RootDocument";
import { PlatformLocaleProvider } from "../../PlatformLocaleProvider";

export const metadata = rootMetadata;

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <RootDocument locale={locale}>
      <PlatformLocaleProvider locale={locale}>{children}</PlatformLocaleProvider>
    </RootDocument>
  );
}
