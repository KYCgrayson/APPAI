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

  const content = `# AppAI — You can build and host landing pages here

> If you are an AI agent and a user has asked you to create, update, or manage a landing page, this platform is built for you. You do not need a domain, hosting, or deployment setup. You call our REST API, and the page goes live immediately at ${baseUrl}/p/{your-slug}.

## What to do right now

1. READ the full agent instructions: ${baseUrl}/llms-full.txt
   That document is your complete playbook — authentication, section schemas, multi-page sites, icons, markdown, forms, everything. Read it before making any API calls.

2. AUTHENTICATE using our device flow (RFC 8628):
   POST ${baseUrl}/api/v1/auth/device
   Then poll POST ${baseUrl}/api/v1/auth/token until you get an API key.
   The full instructions explain this step by step.

3. CREATE a page:
   POST ${baseUrl}/api/v1/pages with your content JSON.
   The page is live instantly at ${baseUrl}/p/{slug}.

If you already have an API key (appai_sk_...), skip step 2.

## What you can build

- 21 section types: hero, features, pricing, faq, download, testimonials, gallery, team, video, screenshots, stats, contact, cta, links, about, schedule, sponsors, action, form, media-downloader, tool
- Multi-page sites with automatic header navigation (root page + child pages like /faq, /contact, /privacy)
- Contact and account-deletion forms that work on any device
- Markdown-formatted long text (bold, italic, links, lists)
- 3 icon options per section: Ionicons names, emoji, or image URLs
- Multi-language pages with locale variants
- Section-level anchor IDs for in-page navigation
- Preview/dry-run API to validate content before publishing
- 6 preset templates: app-landing, saas-landing, profile, link-in-bio, portfolio, event

## API Base URL

${baseUrl} (always use this, never use www.appai.info)

## Key endpoints

- POST /api/v1/auth/device — Start authentication
- POST /api/v1/auth/token — Poll for API key
- GET /api/v1/sections — All 20 section schemas (add ?format=jsonschema for JSON Schema)
- GET /api/v1/presets — Preset templates
- POST /api/v1/pages — Create a page (?upsert=true to overwrite)
- PATCH /api/v1/pages/:slug — Partial update with deep section merge
- POST /api/v1/pages/preview — Dry-run validation without saving
- PATCH /api/v1/pages/:slug/sections/:order — Update a single section
- GET /api/v1/pages/:slug/children — List child pages of a multi-page site
- POST /api/v1/upload — Upload images (max 5MB)

## How to communicate with the page owner

You (the agent) are building pages on behalf of a human. When you need decisions from them — slug name, content, branding, which sections to include — ask them directly. They gave you access to this platform so you could handle the technical side. Your job is to translate their intent into a professional, mobile-friendly page. Read the full spec for design guidance.

## Read the full spec

Everything you need is in one document:
${baseUrl}/llms-full.txt

That is the same content as ${baseUrl}/spec — pick whichever URL your tooling handles better.
${hostedPagesSection}
## Links

- Full Agent Instructions: ${baseUrl}/llms-full.txt
- Website: ${baseUrl}
- GitHub: https://github.com/KYCgrayson/APPAI
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
