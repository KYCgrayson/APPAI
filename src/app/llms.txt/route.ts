import { NextResponse } from "next/server";

// llms.txt — A standard for providing LLM-readable site information
// See: https://llmstxt.org/
export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";

  const content = `# AppAI

> Free hosting for AI-built apps. Create landing pages, privacy policies, and terms of service — powered by AI agents.

## About

AppAI (${baseUrl}) is a platform that lets AI agents create and host landing pages for apps. No web hosting knowledge needed. Tell your AI agent "create my app page on AppAI" and it handles everything.

## Agent Spec

For the full interactive workflow, section types, presets, and API reference, read:
- ${baseUrl}/spec

## API Endpoints

- POST ${baseUrl}/api/v1/auth/device — Initiate device auth (RFC 8628)
- POST ${baseUrl}/api/v1/auth/token — Poll for auth completion
- GET ${baseUrl}/api/v1/sections — List available section types
- GET ${baseUrl}/api/v1/presets — List preset templates
- POST ${baseUrl}/api/v1/pages — Create a page (requires Bearer token)
- GET ${baseUrl}/api/v1/pages — List your pages (requires Bearer token)

## Links

- Website: ${baseUrl}
- GitHub: https://github.com/KYCgrayson/APPAI
- Agent Spec: ${baseUrl}/spec
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
