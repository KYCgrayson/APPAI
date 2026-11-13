import { publicPageWhere } from "@/lib/hosted-page-visibility";
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
      where: publicPageWhere(),
      select: { slug: true, locale: true, title: true, tagline: true, updatedAt: true, isDefault: true, content: true },
      orderBy: [{ updatedAt: "desc" }, { slug: "asc" }, { locale: "asc" }],
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

Start at https://appai.info/spec — the short overview.

## Choose a use-case

| Name | Meaning | Topic page |
|---|---|---|
| Hosted Page | A product, business or person to describe — a public page at appai.info/p/{slug}. | https://appai.info/spec/pages |
| Wrapped tool | A tool already deployed elsewhere (Vercel, Cloudflare Pages, Netlify, GitHub Pages) — AppAI wraps it in a page with SEO, language and theme. | https://appai.info/spec/tools |
| Connected tool | A tool that needs a backend, login or quota — wrapped as above and connected to an owner-maintained connector. | https://appai.info/spec/tools |
| Universal App | Persistent data and business rules — a reviewed app manifest that runs at appai.info/app/{appId}. | https://appai.info/spec/apps |

Do not turn a database application into a landing-page section.

## Agent authorization

Show the user verification_uri_complete: open it in the user's own browser if you can, and always print it. Also print the returned user_code so the user can compare it with the approval page. The user signs in with Google if asked, checks that the code matches, and clicks Approve. Never approve it yourself. The agent receives the key — nothing to copy or paste. This is the agent-driven device flow (RFC 8628):

1. POST ${baseUrl}/api/v1/auth/device.
2. Show the user verification_uri_complete: open it in the user's own browser if you can, and always print it. Also print the returned user_code so the user can compare it with the approval page. The user signs in with Google if asked, checks that the code matches, and clicks Approve. Never approve it yourself. The agent receives the key — nothing to copy or paste.
3. Poll POST ${baseUrl}/api/v1/auth/token at the returned interval until the agent receives the API key; adopt the new interval on slow_down.

Never ask the user to generate and paste a key. Reuse a securely stored key when available; keep it outside the working tree or in memory. Read ${baseUrl}/spec/api for authorization and storage rules.

## Hosted Page: publish flow

Hosted Pages are always published in four locales: English (en), Traditional Chinese (zh-TW), Simplified Chinese (zh-CN) and Spanish (es). Publish all four without asking the user. For any other language, ask the user whether they want it; add only the languages the user chooses, and add none if the user does not choose. Do not wait for that answer before publishing the four.

1. READ ${baseUrl}/spec, then follow ${baseUrl}/spec/api for agent authorization.
2. MUST READ ${baseUrl}/spec/style before publishing for logo rules; choose kits at ${baseUrl}/spec/theme, then pick text size at ${baseUrl}/spec/typography. Copy themeColor, themeColorSecondary, fontFamily (Chinese variants: Noto Sans TC/SC) and darkMode together; use the kit's suggested backgroundColors for section data.backgroundColor when provided; otherwise leave it unset. Exception: cta ignores backgroundColor and always uses themeColor. Use the kit fontFamily for en and es, Noto Sans TC for zh-TW and Noto Sans SC for zh-CN; for other CJK languages chosen by the user, choose the matching font (e.g. Noto Sans JP for Japanese). Keep themeColor, themeColorSecondary, darkMode and backgroundColors the same across variants. 'no logo' means you make one. If the user has no logo, create a simple square 512×512 PNG following the Logo rules, upload it with POST /api/v1/upload, then publish. Agents MUST supply a logo. Non-blocking platform warnings are a fallback, not permission to skip it.
3. Build a first draft using ${baseUrl}/spec/pages and ${baseUrl}/spec/sections.
4. Dry-run using ${baseUrl}/spec/api#dry-run, then POST ${baseUrl}/api/v1/pages with the same content JSON. The page is live instantly at ${baseUrl}/p/{slug}.

Pick the kit by the user's stated mood first (e.g. 'fresh and calm' → forest), then by business type. If no kit description matches, pick by light/dark and warm/cool.

| Kit | Mode | Mood words | Typical businesses |
|---|---|---|---|
| indigo | light | crisp, modern, confident | SaaS, software, technology, professional services |
| forest | light | natural, wellbeing, fresh and calm | nature, wellness, health, sustainable businesses |
| editorial | light | literary, refined, thoughtful | publishing, portfolios, culture, consulting |
| ocean | light | clear, cool, trustworthy | travel, education, healthcare, services |
| midnight | dark | sleek, technical, bold | developer tools, gaming, technology |
| hearth | light | warm, handmade, welcoming | bakeries, cafés, crafts, classes |
| ember | dark | warm, intimate, atmospheric | restaurants, bars, hospitality, creative studios |

Before writing privacyPolicy, ASK the user what data the app collects, stores, or sends (including photos, analytics, and accounts). Never guess. Publish a delete-account child page only if the app has user accounts; FAQ/contact child pages follow the usual rules. Give both store URLs; the page picks the right one per device. Hero primary button = the store the user listed first. Set hero ctaUrl/ctaSecondaryUrl to the store URLs in that order; recognized apps.apple.com and play.google.com URLs render badges in every hero variant. Both badges render server-side; iOS emphasizes App Store first, Android Google Play first; desktop keeps both. Badge dimensions stay fixed during client reordering. Square PNG logo/icon: 512×512 recommended, 1024×1024 accepted. Wrapped tools: read https://appai.info/spec/tools for sandbox, locale and framing headers; check response headers with curl -sI and fix them on the user’s host before publishing. canonicalUrl is only for a primary marketing site, never the embedded *.vercel.app URL.
Use built-in icon names or any emoji. YouTube/Vimeo/mp4 → video; social posts (TikTok/Instagram/X) → embed. For the primary action (store, booking channel, or tool), use the first one the user listed as the hero CTA; include all store URLs in download and all booking channels in contact.socials. If the user gave no street address, omit the address field and any location section; mention the city in copy only if the user gave it. Menus/service price lists: put the price in price on features.items. Contact supports hours ([{days:["mon"],open:"09:00",close:"17:00"}]), optional note, and map:true for Google/Apple Maps links without keys. Optional video/embed goes after about sections and before contact. Instagram posts/reels use official sandboxed iframes. Logo converters: rsvg-convert, macOS qlmanage -t -s 512 -o . logo.svg / sips, or ImageMagick.

Use only supplied contact details; follow ${baseUrl}/spec/pages#contact for phone/LINE links and compliance text.

## Optional shortcut: Claude Code skill

The official skill provides design guidance and the device authorization flow, and points to GET /api/v1/sections for current section schemas:

    /plugin marketplace add KYCgrayson/appai-skill
    /plugin install appai-publish@appai-skill

After install, the user can say "publish a landing page for X". Skill source: https://github.com/KYCgrayson/appai-skill

## Universal App: natural publish flow

AppAI is a universal host, not a source-repository requirement. Build the app
in any workspace, then publish an immutable source package. A repository URL
is optional provenance metadata; Simpleshop is only one app using this generic
contract.

1. AUTHORIZE the agent through the same device flow: Show the user verification_uri_complete: open it in the user's own browser if you can, and always print it. Also print the returned user_code so the user can compare it with the approval page. The user signs in with Google if asked, checks that the code matches, and clicks Approve. Never approve it yourself. The agent receives the key — nothing to copy or paste. Reuse a securely stored key when available.
2. ADD appai.app.json at the app root. It declares id, version, lockfile-strict install command (npm ci, pnpm install --frozen-lockfile, or yarn install --immutable), build/start commands, health path, optional migration, and requested capabilities. The app owns UI, API, business rules, schema, migrations, tests, and typecheck.
3. PACKAGE the exact source revision. Do not include node_modules, build output, .git, environment files (except a values-free .env.example), database dumps, credentials, or secrets:

       git archive --format=tar.gz --output=appai-release.tar.gz HEAD

   The archive root must contain the exact same appai.app.json supplied in the release request.
4. REQUEST a private upload intent:

       POST ${baseUrl}/api/v1/apps/{appId}/release-packages
       Authorization: Bearer appai_sk_YOUR_KEY
       {"filename":"appai-release.tar.gz","sizeBytes":12345,"contentType":"application/gzip"}

   The default response contains uploadId, pathname, and clientToken. Use @vercel/blob/client put(pathname, packageFile, { access: "private", token: clientToken }); do not log, expose, or reuse these short-lived transport values. The signed-in Publisher Portal may instead request "uploadMethod":"server" for a package of 4 MiB or less, then POST that file as same-origin multipart form data to /api/v1/apps/{appId}/release-packages/{uploadId}/upload. That server transport never returns a Blob pathname, URL, or token. The public package limit remains 20 MiB; larger packages use the direct private upload.
5. COMPUTE lowercase SHA-256 of the exact package bytes and FINALIZE:

       POST ${baseUrl}/api/v1/apps/{appId}/releases
       Authorization: Bearer appai_sk_YOUR_KEY
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

## Games

Read ${baseUrl}/spec/games. Deploy original game files to your own GitHub Pages,
Cloudflare Pages, Vercel or Netlify host; AppAI supplies a GAME page with a game
section, SEO shell, fullscreen play, how-to-play and FAQ. A game section works on
any template. Developer-published games use /p/{slug} today; future /games/{slug}
URLs and redirects from /p/{slug} are planned, not implemented. AppAI's own games have descriptions at
/games/{slug} and playable builds at /games/{slug}/play.
listInGames is an application only, gamesListing: "requested" means
pending, and publishing does not add a game to ${baseUrl}/games.
New external GAME listings are unapproved and excluded from homepage App listings.
Package C game review/listing management and external room creation/access are
planned, not built; there is no game review API to call today.
Only approved origins can call the room-code API from a browser: POST /api/rooms,
POST /api/rooms/{code}/join, GET /api/rooms/{code}?since={version},
POST /api/rooms/{code}/start, POST /api/rooms/{code}/moves; 2–4 players,
state <= 8 KB, one move <= 1 KB. Room creation currently needs AppAI sign-in
and a same-origin cookie; external games wait for supported access. Games
currently receive no AppAI identity or session, even with identity: true. Identity
is planned to be approval-gated, but is not implemented even for approved games.
Own puzzle leaderboards exist under river-crossing; external leaderboard declarations
are stored only and do not provision boards or score validation.
Supply privacyPolicy and termsOfService per root locale; AppAI does not
automatically provide game-specific policies. Cover images load from their
image host, which can see visitors’ IP addresses.
Read ${baseUrl}/spec/games#technical-guide for static exports, mobile, sandbox and
enforced versus recommended size budgets. Follow ${baseUrl}/spec/games#worked-example-guess-duel
for the real repo layout, build, full payload, upload, dry-run, publish and checklist.
Copyable payload: ${baseUrl}/spec/examples/guess-duel.example.json.

## What you can build

- 30 section types: profile-header, project-cards, entries, hero, features, pricing, faq, download, testimonials, gallery, team, video, screenshots, stats, contact, cta, links, about, schedule, sponsors, action, form, media-downloader, video-subtitle, tool, pdf-viewer, embed (TikTok/Loom/X/YouTube/Vimeo/Spotify/CodePen/Figma), simple-order, iframe-tool, game
- Multi-page sites with automatic header navigation (root page + child pages like /p/my-app/my-app-faq, /p/my-app/my-app-contact, /p/my-app/my-app-delete-account; prefix child slugs with the root slug because (slug, locale) is globally unique; privacy/terms use privacyPolicy/termsOfService fields)
- Contact and account-deletion forms that work on any device
- Markdown-formatted long text (bold, italic, links, lists)
- 3 icon options per section: Ionicons names, emoji, or image URLs
- Multi-language pages with locale variants
- Section-level anchor IDs for in-page navigation
- Preview/dry-run API to validate content before publishing
- 11 presets with full example POST bodies and 7 named style kits: app-landing, saas-landing, profile, link-in-bio, portfolio, event, company-service, product, hiring, iframe-tool, game

## API Base URL

${baseUrl} (always use this, never use www.appai.info)

## Key endpoints

- POST /api/v1/auth/device — Start authentication
- POST /api/v1/auth/token — Poll for API key
- GET /api/v1/sections — All 30 section schemas (add ?format=jsonschema for JSON Schema)
- GET /api/v1/presets — Preset templates
- POST /api/v1/pages — Create a page (?upsert=true to overwrite)
- PATCH /api/v1/pages/:slug — Partial update with deep section merge
- POST /api/v1/pages?dryRun=true (identical to POST /api/v1/pages/preview) — Pre-flight validation without saving; returns errors, warnings, sanitizedContent, next
- Agents MUST provide content.logo (or hero data.logo / headerLogo): square PNG, 512×512 recommended, 1024×1024 accepted, app-icon style with its own background; HTTPS or same-origin /path. Upload local files via POST /api/v1/upload. Missing or non-HTTPS logos warn without blocking publishing. Replace demo logos with the real logo. 'no logo' means you make one. If the user has no logo, create a simple square 512×512 PNG following the Logo rules, upload it with POST /api/v1/upload, then publish. Agents MUST supply a logo. Non-blocking platform warnings are a fallback, not permission to skip it.
- PATCH /api/v1/pages/:slug/sections/:order — Update a single section
- GET /api/v1/pages/:slug/children — List child pages of a multi-page site
- POST /api/v1/upload — Upload images (max 5MB)
- POST /api/v1/apps/:appId/releases — Submit a Universal App release for platform review; returns PENDING
- GET /api/v1/apps/:appId/releases/:releaseId — Poll a submitted Universal App release's review and deployment state

## Universal Apps and managed data

Universal Apps are login-protected applications with persistent Organization data. Agents may submit an executable application's reviewed release through the Universal App flow above; AppAI never imports that app server into the AppAI process. The server derives the Organization from the API key or browser session. Do not send organizationId, runtime/deployment URLs, credentials, component names, SQL, or secrets. Simpleshop is the first example of this generic contract, not a special publishing API.

## How to communicate with the page owner

You (the agent) are building pages on behalf of a human. Gather minimum context and build a complete first draft immediately. Decide the template, sections, colors, fonts and compliance pages yourself. Ask only for product-specific facts you cannot infer, unmentioned specific branding preferences, whether to add languages beyond the four defaults, or genuine design tradeoffs; see ${baseUrl}/spec/pages#what-to-decide-yourself-do-not-ask-the-user and ${baseUrl}/spec/pages#when-to-ask-the-user. Hosted Pages are always published in four locales: English (en), Traditional Chinese (zh-TW), Simplified Chinese (zh-CN) and Spanish (es). Publish all four without asking the user. For any other language, ask the user whether they want it; add only the languages the user chooses, and add none if the user does not choose. Do not wait for that answer before publishing the four. Translate their intent into a professional, mobile-friendly page and iterate with PATCH.

If appai is missing something you need, still publish with existing fields; don’t wait for the feature. Then report it with POST /api/v1/feedback (kind: missing_feature).

## Complete single-file fallback

${baseUrl}/llms-full.txt — the complete specification when a single file is needed. Start at ${baseUrl}/spec for the short overview and follow its topic pages.

## Topic pages

- Authorization & API: ${baseUrl}/spec/api — agent authorization, key storage, dry-run, image upload and API discovery
- Style & logo: ${baseUrl}/spec/style — logo and two style steps
- Theme: ${baseUrl}/spec/theme — colors, backgrounds and style kits
- Typography: ${baseUrl}/spec/typography — font, text size, contrast and role overrides
- Pages: ${baseUrl}/spec/pages — configuration, CRUD and workflow
- Sections: ${baseUrl}/spec/sections — section schemas and icons
- Multi-language & multi-page: ${baseUrl}/spec/i18n — languages, child pages and navigation
- Tools: ${baseUrl}/spec/tools — Wrapped tool, Connected tool, identity and access
- Universal App: ${baseUrl}/spec/apps — manifests, releases, review and runtime
- Games: ${baseUrl}/spec/games — technical guide, Guess Duel worked example, room API, current listing/identity/leaderboard status
${hostedPagesSection}
## Links

- Complete single-file fallback: ${baseUrl}/llms-full.txt
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
