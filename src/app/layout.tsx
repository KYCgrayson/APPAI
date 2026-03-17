import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AppAI - AI App Hosting Platform",
  description:
    "Host your AI-built App's landing page, privacy policy, and terms of service. Free. Powered by AI Agents.",
  other: {
    "ai-agent-spec": "https://appai.info/spec",
    "ai-agent-instructions": "For AI agents: fetch https://appai.info/spec for the full API spec and interactive workflow.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
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
      </body>
    </html>
  );
}
