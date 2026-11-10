import { serializeJsonLd } from "@/lib/json-ld";
import { PLATFORM_ORIGIN } from "@/lib/platform-identity";
import { parsePageSegments } from "@/lib/parse-page-segments";
import { resolvePage, resolveChildPage } from "@/lib/hosted-page-resolver";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AppAI - AI App Hosting Platform",
  description:
    "Publish AI-built hosted pages and database-capable Universal Apps. AppAI provides review, identity, and managed capabilities.",
  other: {
    "ai-agent-spec": "https://appai.info/spec",
    "ai-agent-instructions": "AI agents: Start at https://appai.info/spec. Choose among four use-cases: Hosted Page, Wrapped tool, Connected tool, Universal App. Follow the overview and its topic pages; https://appai.info/llms-full.txt is the complete single-file fallback. Never submit organizationId, credentials, runtime URLs, SQL, or secrets.",
  },
};

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

  return (
    <html lang={locale} dir={["ar", "he", "fa", "ur"].includes(locale.split("-")[0]) ? "rtl" : "ltr"}>
      <head>
        <link rel="icon" href="/appai-logo2.png" />
        <link rel="apple-touch-icon" href="/appai-logo2.png" />
        <link rel="alternate" type="text/plain" href="/spec" title="AI Agent Spec" />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM Info" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${PLATFORM_ORIGIN}/#org`,
                  name: "AppAI",
                  alternateName: "AIGA",
                  url: "https://appai.info",
                  logo: {
                    "@type": "ImageObject",
                    "@id": "https://appai.info/#logo",
                    url: "https://appai.info/appai-logo2.png",
                    caption: "AppAI",
                  },
                  sameAs: [
                    "https://github.com/KYCgrayson/APPAI",
                  ],
                },
                {
                  "@type": "WebSite",
                  "@id": `${PLATFORM_ORIGIN}/#website`,
                  url: "https://appai.info",
                  name: "AppAI",
                  description:
                    "A publishing platform for AI-built hosted pages and reviewed, database-capable Universal Apps.",
                  publisher: { "@id": `${PLATFORM_ORIGIN}/#org` },
                  inLanguage: ["en", "ja", "ko", "zh-CN", "zh-TW", "de", "fr", "es", "hi"],
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className="antialiased font-sans"
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
