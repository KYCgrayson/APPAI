import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ISR: regenerate at most once per hour. Create/update API routes should call
// revalidatePath('/llms.txt') on publish for instant refresh.
export const revalidate = 3600;

// llms.txt — A standard for providing LLM-readable site information
// See: https://llmstxt.org/
export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";

  // Fetch all published pages (root only — child pages are discoverable from
  // the root). Tolerate DB unavailability (e.g. local builds without a real
  // Postgres): fall back to an empty page list instead of failing the build.
  let pages: {
    slug: string;
    locale: string;
    title: string;
    tagline: string | null;
    updatedAt: Date;
    isDefault: boolean;
    content: unknown;
  }[] = [];
  try {
    pages = await db.hostedPage.findMany({
      where: { isPublished: true, parentSlug: null },
      select: { slug: true, locale: true, title: true, tagline: true, updatedAt: true, isDefault: true, content: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
  } catch (e) {
    // Local builds without a real Postgres: serve the static portion only.
    // Production keeps failing loudly (stale ISR is preserved).
    if (process.env.ALLOW_LOCAL_HTTP_BACKEND !== "1") throw e;
  }

  // Group by slug; pick the default locale row as the representative
  type PageInfo = {
    slug: string;
    title: string;
    tagline: string | null;
    updatedAt: Date;
    locales: string[];
    sectionTypes: string[];
  };
  const slugMap = new Map<string, PageInfo>();
  for (const page of pages) {
    const existing = slugMap.get(page.slug);
    if (existing) {
      existing.locales.push(page.locale);
      if (page.updatedAt > existing.updatedAt) existing.updatedAt = page.updatedAt;
    } else {
      const sections = (page.content as { sections?: Array<{ type?: string }> })?.sections || [];
      const sectionTypes = Array.from(
        new Set(sections.map((s) => s?.type).filter((t): t is string => typeof t === "string"))
      );
      slugMap.set(page.slug, {
        slug: page.slug,
        title: page.title,
        tagline: page.tagline,
        updatedAt: page.updatedAt,
        locales: [page.locale],
        sectionTypes,
      });
    }
  }

  const hostedPagesSection = slugMap.size > 0
    ? `\n## Hosted Pages\n\n${[...slugMap.values()]
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map((p) => {
          const date = p.updatedAt.toISOString().slice(0, 10);
          const taglinePart = p.tagline ? `: ${p.tagline}` : "";
          const sectionsPart = p.sectionTypes.length
            ? ` [sections: ${p.sectionTypes.join(", ")}]`
            : "";
          return `- ${baseUrl}/p/${p.slug} — ${p.title}${taglinePart} (updated ${date}, locales: ${p.locales.join(", ")})${sectionsPart}`;
        })
        .join("\n")}\n`
    : "";

  const content = `# AppAI — publish hosted pages and full applications

> AppAI has two first-class publishing modes for AI agents. Use a Hosted Page for a public product site at ${baseUrl}/p/{your-slug}. Use a Universal App for a full application, including database-backed workflows, that launches at ${baseUrl}/app/{appId} after platform review. Do not turn a database application into a landing-page section.

## Fastest path (recommended): install the official skill

If you are running inside Claude Code, have the user install the official AppAI skill — you (the agent) then get a pre-baked playbook with all design decisions, section schemas, and the auth flow already wired:

    /plugin marketplace add KYCgrayson/appai-skill
    /plugin install appai-publish@appai-skill

After install, the user can simply say "publish a landing page for X" and you will have everything you need. Skill source: https://github.com/KYCgrayson/appai-skill

If a skill install is not available in your environment, continue with the manual flow below.

## Choose a publishing mode

| Mode | Use it for | Public path | What the agent submits |
| --- | --- | --- | --- |
| Hosted Page | Marketing sites, documentation, forms, public tools | ${baseUrl}/p/{slug} | Page JSON to the Pages API |
| Universal App | Full UI + API + business rules, persistent Organization data, database or private assets | ${baseUrl}/app/{appId} | appai.app.json and an immutable source package |

## Hosted Page: manual flow

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

## Universal App: natural publish flow

AppAI is a universal host, not a source-repository requirement. Build the app
in any workspace, then publish an immutable source package. A repository URL
is optional provenance metadata; Simpleshop is only one app using this generic
contract.

1. AUTHENTICATE through the same device flow or use an existing API key.
2. ADD appai.app.json at the app root. It declares id, version, lockfile-strict install command (npm ci, pnpm install --frozen-lockfile, or yarn install --immutable), build/start commands, health path, optional migration, and requested capabilities. The app owns UI, API, business rules, schema, migrations, tests, and typecheck.
3. PACKAGE the exact source revision. Do not include node_modules, build output, .git, environment files (except a values-free .env.example), database dumps, credentials, or secrets:

       git archive --format=tar.gz --output=appai-release.tar.gz HEAD

   The archive root must contain the exact same appai.app.json supplied in the release request.
4. REQUEST a private upload intent:

       POST ${baseUrl}/api/v1/apps/{appId}/release-packages
       Authorization: Bearer appai_sk_...
       {"filename":"appai-release.tar.gz","sizeBytes":12345,"contentType":"application/gzip"}

   The default response contains uploadId, pathname, and clientToken. Use @vercel/blob/client put(pathname, packageFile, { access: "private", token: clientToken }); do not log, expose, or reuse these short-lived transport values. The signed-in Publisher Portal may instead request "uploadMethod":"server" for a package of 4 MiB or less, then POST that file as same-origin multipart form data to /api/v1/apps/{appId}/release-packages/{uploadId}/upload. That server transport never returns a Blob pathname, URL, or token. The public package limit remains 20 MiB; larger packages use the direct private upload.
5. COMPUTE lowercase SHA-256 of the exact package bytes and FINALIZE:

       POST ${baseUrl}/api/v1/apps/{appId}/releases
       Authorization: Bearer appai_sk_...
       {"manifest":{...},"tagline":"...","description":"...","category":"INVENTORY","source":{"type":"package","uploadId":"...","digest":"sha256:<64 lowercase hex chars>","sizeBytes":12345}}

6. The receipt is PENDING and awaits AppAI platform review. AppAI validates the package, runs test/typecheck/build in isolation, provisions approved database/private-asset capabilities, runs migrations with a separate role, deploys, health-checks, and activates only verified evidence. Poll GET ${baseUrl}/api/v1/apps/{appId}/releases/{releaseId} until the release is APPROVED and production deployment is ACTIVE, then users launch ${baseUrl}/app/{appId}.

Never submit organizationId, runtime/deployment URLs, database credentials,
raw SQL, provider/OIDC/CLI credentials, arbitrary secrets, or platform
infrastructure settings. AppAI controls runtime, database, authentication,
domain, and activation; agents cannot choose a runtime domain.

### Database runtime contract

Requesting database asks AppAI to provision app-scoped PostgreSQL. AppAI injects
server-only DATABASE_URL into the approved isolated runtime. Schema and
migrations stay in the app workspace and immutable release package; AppAI runs migrationCommand with a
separate migration role and gives the runtime only target-schema DML/sequence
permissions. APPAI_PLATFORM_URL and APPAI_APP_ID identify the platform and app.
Never expose DATABASE_URL in browser/client bundles or a public environment variable.

User and Organization context comes only from launch-code exchange and runtime
session introspection. Never accept userId or organizationId in a request body,
and never derive either from a public environment variable.

### Required app authentication chrome and logout

Every Universal App treats /app/{appId} as the AppAI SSO login gate. Exchange
the one-time launch code at POST /api/runtime/sessions/exchange and obtain the
trusted runtime context from POST /api/runtime/sessions/introspect; do not
invent a separate browser identity contract.

Every protected app screen needs a conventional responsive top-right header:
show a safe signed-in user name or email plus Organization name, or the neutral
fallback "Signed in with AppAI" if identity display is unavailable. Include
Return to AppAI and a POST app logout action. Do not show raw userId,
organizationId, runtime token, credentials, or database URLs in browser UI.

App logout calls POST /api/runtime/sessions/revoke using the runtime bearer and
a strict matching appId, clears the app's local HttpOnly runtime-session cookie,
then routes to AppAI /logout?callbackUrl=/ for platform signout. Do not put any
of these values in a public environment variable.

## What you can build

- 26 section types: hero, features, pricing, faq, download, testimonials, gallery, team, video, screenshots, stats, contact, cta, links, about, schedule, sponsors, action, form, media-downloader, video-subtitle, tool, pdf-viewer, embed (TikTok/Loom/X/YouTube/Vimeo/Spotify/CodePen/Figma), simple-order
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
- GET /api/v1/sections — All 26 section schemas (add ?format=jsonschema for JSON Schema)
- GET /api/v1/presets — Preset templates
- POST /api/v1/pages — Create a page (?upsert=true to overwrite)
- PATCH /api/v1/pages/:slug — Partial update with deep section merge
- POST /api/v1/pages/preview — Dry-run validation without saving
- PATCH /api/v1/pages/:slug/sections/:order — Update a single section
- GET /api/v1/pages/:slug/children — List child pages of a multi-page site
- POST /api/v1/upload — Upload images (max 5MB)
- POST /api/v1/apps/:appId/releases — Submit a Universal App release for platform review; returns PENDING
- GET /api/v1/apps/:appId/releases/:releaseId — Poll a submitted Universal App release's review and deployment state

## Universal Apps and managed data

Universal Apps are login-protected applications with persistent Organization data. Agents may submit an executable application's reviewed release through the Universal App flow above; AppAI never imports that app server into the AppAI process. The server derives the Organization from the API key or browser session. Do not send organizationId, runtime/deployment URLs, credentials, component names, SQL, or secrets. Simpleshop is the first example of this generic contract, not a special publishing API.

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
- Claude Code Skill: https://github.com/KYCgrayson/appai-skill
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
