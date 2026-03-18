import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// llms.txt — A standard for providing LLM-readable site information
// See: https://llmstxt.org/
export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";

  // Fetch published pages grouped by slug for listing
  const pages = await db.hostedPage.findMany({
    where: { isPublished: true },
    select: { slug: true, locale: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  // Group by slug
  const slugMap = new Map<string, { title: string; locales: string[] }>();
  for (const page of pages) {
    const existing = slugMap.get(page.slug);
    if (existing) {
      existing.locales.push(page.locale);
    } else {
      slugMap.set(page.slug, { title: page.title, locales: [page.locale] });
    }
  }

  const hostedPagesSection = slugMap.size > 0
    ? `\n## Hosted Pages\n\n${[...slugMap.entries()]
        .map(([slug, { title, locales }]) =>
          `- ${baseUrl}/p/${slug} — ${title} (${locales.join(", ")})`
        )
        .join("\n")}\n`
    : "";

  const content = `# AppAI

> Free hosting for AI-built apps. Get a landing page, privacy policy, and terms of service in 30 seconds.

## About

AppAI (${baseUrl}) lets AI agents create and host professional landing pages for apps. No domain, no hosting setup, no deployment needed.

## Quick Start

To create a page, your AI agent should read the full spec:
- ${baseUrl}/spec
- ${baseUrl}/llms-full.txt

## API Base URL

${baseUrl} (always use this, never use www.appai.info)

## Key Endpoints

- POST /api/v1/auth/device — Authenticate via device flow (RFC 8628)
- POST /api/v1/auth/token — Poll for auth token
- GET /api/v1/sections — Available section types (17 types)
- GET /api/v1/presets — Preset templates (6 presets)
- POST /api/v1/pages — Create a page (supports locale parameter for multi-language)
- PUT /api/v1/pages/:slug — Update a page
- PATCH /api/v1/pages/:slug — Partial update with deep merge
- POST /api/v1/upload — Upload images (multipart/form-data)

## Features

- 17 section types: hero, features, pricing, faq, download, testimonials, gallery, team, video, screenshots, stats, contact, cta, links, about, schedule, sponsors
- 6 presets: app-landing, saas-landing, profile, link-in-bio, portfolio, event
- Multi-language pages: create locale variants (e.g. en, ja, zh-CN) for the same slug
- Auto-generated sticky header with logo, nav, language switcher, and download button
- Auto-generated footer with privacy/terms links
- Alternating section background colors
- Custom section background colors
- Dynamic favicon from project logo
- Image upload API (PNG, JPEG, GIF, WebP, SVG, max 5MB)
- Privacy policy and terms of service pages
- JSON-LD structured data for SEO
- hreflang tags for multi-language SEO
${hostedPagesSection}
## Links

- Website: ${baseUrl}
- Full Spec: ${baseUrl}/llms-full.txt
- Agent Instructions: ${baseUrl}/spec
- GitHub: https://github.com/KYCgrayson/APPAI
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
