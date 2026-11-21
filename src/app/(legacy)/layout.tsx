import { parsePageSegments } from "@/lib/parse-page-segments";
import { resolvePage, resolveChildPage } from "@/lib/hosted-page-resolver";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { RootDocument, rootMetadata } from "../RootDocument";

export const metadata = rootMetadata;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const hostedPath = requestHeaders.get("x-appai-hosted-path");
  const parsed = hostedPath?.startsWith("/p/")
    ? parsePageSegments(hostedPath.slice(3).split("/").filter(Boolean)) : null;
  let hostedLocale: string | undefined;
  if (parsed) {
    const root = await resolvePage(parsed.slug, parsed.locale);
    const page = root && parsed.childSlug
      ? await resolveChildPage(parsed.slug, parsed.childSlug, parsed.locale, root.organizationId) : root;
    hostedLocale = page?.locale;
  }
  const locale = hostedLocale || await getLocale();

  return <RootDocument locale={locale}>{children}</RootDocument>;
}
