import { NextResponse } from "next/server";

// llms.txt — A standard for providing LLM-readable site information
// See: https://llmstxt.org/
export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";

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
- POST /api/v1/pages — Create a page
- PUT /api/v1/pages/:slug — Update a page
- POST /api/v1/upload — Upload images (multipart/form-data)

## Features

- 17 section types: hero, features, pricing, faq, download, testimonials, gallery, team, video, screenshots, stats, contact, cta, links, about, schedule, sponsors
- 6 presets: app-landing, saas-landing, profile, link-in-bio, portfolio, event
- Auto-generated sticky header with logo, nav, and download button
- Auto-generated footer with privacy/terms links
- Alternating section background colors
- Custom section background colors
- Dynamic favicon from project logo
- Image upload API (PNG, JPEG, GIF, WebP, SVG, max 5MB)
- Privacy policy and terms of service pages

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
