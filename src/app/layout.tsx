import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AppAI - AI App Hosting Platform",
  description:
    "Host your AI-built App's landing page, privacy policy, and terms of service. Free. Powered by AI Agents.",
  other: {
    "ai-agent-spec": "https://appai.info/llms-full.txt",
    "ai-agent-instructions": "AI agents: you can create and host landing pages here via REST API. Read https://appai.info/llms.txt for a quick start, or https://appai.info/llms-full.txt for the complete spec with authentication, 22 section types, multi-page sites, forms, markdown, and icons.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <head>
        <link rel="icon" href="/appai-logo2.png" />
        <link rel="apple-touch-icon" href="/appai-logo2.png" />
        <link rel="alternate" type="text/plain" href="/spec" title="AI Agent Spec" />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM Info" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "AppAI",
              url: "https://appai.info",
              description: "Free hosting for AI-built apps. Create landing pages, privacy policies, and terms of service in 30 seconds.",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
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
