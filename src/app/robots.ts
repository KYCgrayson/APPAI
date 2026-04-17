import type { MetadataRoute } from "next";

// AppAI is a hosting platform whose entire value is AI discoverability.
// Default posture: explicit Allow for every major AI crawler on /p/* (hosted
// pages) and /llms.txt / /llms-full.txt / /spec. Block only internal surfaces
// (api, dashboard, admin, auth) — same rules for humans and AI bots.
// List maintained from 2025-2026 crawler surveys; add new bots as they appear.
const AI_CRAWLERS = [
  "GPTBot",              // OpenAI training
  "OAI-SearchBot",       // OpenAI search/answers
  "ChatGPT-User",        // OpenAI user-triggered fetches
  "ClaudeBot",           // Anthropic training
  "Claude-SearchBot",    // Anthropic search
  "Claude-User",         // Anthropic user-triggered
  "anthropic-ai",        // Legacy Anthropic UA
  "PerplexityBot",       // Perplexity indexing
  "Perplexity-User",     // Perplexity user-triggered
  "Google-Extended",     // Google Gemini/AI Overviews opt-in
  "Googlebot",           // Google search (serves AI Overviews)
  "Applebot",            // Apple search
  "Applebot-Extended",   // Apple AI opt-in token
  "Bingbot",             // Microsoft / Copilot
  "CopilotBot",          // Microsoft Copilot
  "CCBot",               // Common Crawl
  "Bytespider",          // ByteDance
  "Amazonbot",           // Amazon
  "Meta-ExternalAgent",  // Meta training
  "Meta-ExternalFetcher",// Meta user-triggered
  "DuckAssistBot",       // DuckDuckGo
  "YouBot",              // You.com
  "Kagibot",             // Kagi
  "Mistralbot",          // Mistral
  "cohere-ai",           // Cohere
  "Diffbot",             // Diffbot
  "FacebookBot",         // Meta FB linking
  "Twitterbot",          // X preview
  "LinkedInBot",         // LinkedIn preview
  "Pinterestbot",        // Pinterest preview
];

const DISALLOW_PATHS = ["/api/", "/dashboard/", "/admin/", "/auth/"];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";

  const rules: MetadataRoute.Robots["rules"] = [
    { userAgent: "*", allow: "/", disallow: DISALLOW_PATHS },
    ...AI_CRAWLERS.map((userAgent) => ({
      userAgent,
      allow: "/",
      disallow: DISALLOW_PATHS,
    })),
  ];

  return {
    rules,
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl.replace(/^https?:\/\//, ""),
  };
}
