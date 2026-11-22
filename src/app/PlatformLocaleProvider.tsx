import { serializeJsonLd } from "@/lib/json-ld";
import { PLATFORM_ORIGIN } from "@/lib/platform-identity";
import { NextIntlClientProvider } from "next-intl";

export async function PlatformLocaleProvider({ children, locale }: { children: React.ReactNode; locale: string }) {
  const messages = (await import(`../messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "@id": `${PLATFORM_ORIGIN}/#app`,
          name: "AppAI",
          url: PLATFORM_ORIGIN,
          description: "A publishing platform for AI-built apps and multi-language landing pages.",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          publisher: { "@id": `${PLATFORM_ORIGIN}/#org` },
          isPartOf: { "@id": `${PLATFORM_ORIGIN}/#website` },
        }) }}
      />
      {children}
    </NextIntlClientProvider>
  );
}
