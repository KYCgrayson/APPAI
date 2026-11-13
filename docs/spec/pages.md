# AppAI — Pages
Covers Hosted Page configuration, CRUD, compliance and publishing workflow.
Previous: [Typography](https://appai.info/spec/typography) · Next: [Sections](https://appai.info/spec/sections)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

## Contact

Use only supplied contact details in sections, `privacyPolicy` and `termsOfService`; never invent an email. If the user gave no street address, omit `address` and any location section; mention the city in copy only if the user gave it. `contact.phone` renders a tappable phone link; buttons also accept `tel:+{E.164 digits}`.

`contact.socials` is optional: `[{"platform":"instagram","url":"https://www.instagram.com/example/","label":"Message us"}]`. Platforms: `instagram`, `line`, `facebook`, `threads`, `whatsapp`, `x`, `youtube`, `tiktok`, `website`; `label` is optional (defaults to platform name). URLs must be HTTPS; no new URL schemes.

| Channel | Canonical URL |
|---|---|
| Instagram profile / DM | `https://www.instagram.com/{handle}/` / `https://ig.me/m/{handle}` |
| LINE official | `https://line.me/R/ti/p/@{id}` (id without leading @) |
| LINE personal | `https://line.me/ti/p/~{id}` |
| WhatsApp | `https://wa.me/{E.164 digits}` (digits only, no +) |
| Facebook | `https://www.facebook.com/{handle}` |
| Threads | `https://www.threads.com/@{handle}` |
| X | `https://x.com/{handle}` |
| TikTok | `https://www.tiktok.com/@{handle}` |
| YouTube | `https://www.youtube.com/@{handle}` |
| Website | Supplied HTTPS website URL |

For the primary action (store, booking channel, or tool), use the first one the user listed as the hero CTA; include all store URLs in download and all booking channels in contact.socials. Use the supplied channel in compliance copy too. Use `simple-order` only for order + payment flows with a supplied `notificationEmail`.

## What You Can Build (read this first)

This platform gives you full control over visual design. Every parameter below is available for you to use.

### Page-Level Configuration

| Parameter | Description |
|-----------|-------------|
| `template` | `APP_LANDING`, `COMPANY_PROFILE`, `PRODUCT_SHOWCASE`, `PORTFOLIO`, `LINK_IN_BIO`, `PERSON`, `GAME` (`GAME` adds the title H1; sections control the remaining content). |
| `themeColor` | Hex color (e.g. `#6366F1`) — drives CTA buttons, accents, links. Copy `themeColor`, `themeColorSecondary`, `fontFamily` (Chinese variants: `Noto Sans TC`/`Noto Sans SC`) and `darkMode` together from a kit in [Theme](https://appai.info/spec/theme). |
| `themeColorSecondary` | Hex color — optional accent for secondary buttons. Auto-generated from themeColor if omitted. |
| `darkMode` | Boolean — renders entire page with dark backgrounds and light text. All sections adapt automatically. |
| `fontFamily` | Google Fonts name, loaded automatically per locale variant. Use the kit’s `fontFamily` for `en` and `es`, `Noto Sans TC` for `zh-TW`, and `Noto Sans SC` for `zh-CN`; for other CJK languages chosen by the user, choose the matching font (e.g. `Noto Sans JP` for Japanese). Keep `themeColor`, `themeColorSecondary`, `darkMode` and the kit’s suggested backgroundColors the same across variants. |
| `headerLogo` | URL — separate logo for the light header (when hero logo is white/light). |
| `ogImage` | URL — Open Graph image for social sharing. Fallback order: ogImage → heroImage → profile-header avatar → screenshot or icon of the first project item that has one → first screenshots image (valid HTTP(S) URLs only). |

PERSON pages are live at `/p/{slug}` immediately but appear in the AppAI directory only after AppAI review.

### Public visibility and App bindings

| Record | Public when |
|---|---|
| Root page locale | That row has `isPublished: true`. |
| Child page locale | That row is published and at least one root locale with its `parentSlug` in the **same organisation** is published. |
| App with `hostedPageSlug` | The App is approved and its bound root has a published locale in the **same organisation**. |
| Standalone App (`hostedPageSlug: null` or `""`) | Existing App approval and runtime rules apply. |

These rules apply to hosted routes, navigation, discovery indexes, directories, home cards/counts, App details/social metadata, form/order submissions and tool-session issuance. Hidden hosted routes and App details return 404; hidden App metadata is noindex. A published child stays stored when its root is unpublished, but visitors cannot reach it. Republishing a root makes its published children visible again.

`POST /api/v1/apps` and `PUT /api/v1/apps/{id}` accept `hostedPageSlug` only for a root belonging to the authenticated organisation (a draft root is allowed). A child, foreign root or missing slug returns 400 with `details[].path: ["hostedPageSlug"]`. Clear a binding with `null` or `""` (stored as null); omitting it on PUT preserves the current binding. Clearing an ordinary binding remains supported.

Sitemap and origin discovery caches are invalidated after publishing changes. External `llms.txt` caches may retain the previous response for up to one hour.

### Directory classification

For approved, published root pages, the first matching rule wins: Universal App (`appType` set) → **Apps**; explicit `appai:kind:website|tool|app` tag → **Websites / Tools / Apps**; `iframe-tool`, `tool`, `media-downloader` or `video-subtitle` section → **Tools**; `download` section, App record `iosUrl`/`androidUrl`, or a link anywhere in content to `apps.apple.com`, `itunes.apple.com`, `play.google.com` or `testflight.apple.com` → **Apps**; otherwise → **Websites**, including `APP_LANDING` without app signals. PERSON profiles appear only in **All** and **Personal pages**.

Force a hosted page's kind on its corresponding App record: `PUT /api/v1/apps/{id}` with `{"tags":["appai:kind:website"]}` (top-level `tags` array; preserve any other tags). Find the record by `hostedPageSlug` via `GET /api/v1/apps`. Tags also go at the top level of `POST /api/v1/apps`; the page create/publish payload does not accept them. Universal Apps always remain in Apps.

<a id="29-section-types"></a>

### 30 Section Types

Every section supports `id` (anchor for `#links`). Use kit backgroundColors when provided; otherwise leave `data.backgroundColor` unset. `cta` ignores backgroundColor and always uses themeColor.

| Type | What it does |
|------|-------------|
| [`profile-header`](https://appai.info/spec/sections#profile-header) | Personal h1 `name`, `eyebrow`, `tagline`, Markdown `intro`, optional `avatar: {url, alt}`, `links: [{label, url}]`, `nav: [{label, href}]` anchors. |
| [`project-cards`](https://appai.info/spec/sections#project-cards) | `heading`, `eyebrow`, `items: [{name, category, description, icon: {url, alt}, monogram, screenshot: {url, alt, kind: phone/web, width, height}, links: [{label, url}]}]`. |
| [`entries`](https://appai.info/spec/sections#entries) | `heading`, `eyebrow`, Markdown `intro`, `items: [{title, description}]`, `links: [{label, url}]`; reuse for focus, experience or contact. |
| [`hero`](https://appai.info/spec/sections#hero) | [Hero variants and height](https://appai.info/spec/theme#hero-variants). |
| [`stats`](https://appai.info/spec/sections#stats) | Key numbers (e.g. "10K+ Users", "99.9% Uptime"). 2-column grid on mobile, 4-column on desktop. |
| [`features`](https://appai.info/spec/sections#features) | Feature cards with icons in a responsive grid. 3-6 items recommended. |
| [`pricing`](https://appai.info/spec/sections#pricing) | Pricing comparison cards. 3 tiers recommended. Supports `highlighted` flag. |
| [`testimonials`](https://appai.info/spec/sections#testimonials) | User quote cards with name, role, avatar. |
| [`faq`](https://appai.info/spec/sections#faq) | Expandable Q&A accordion. 5-10 items recommended. Auto-generates FAQ schema for SEO. |
| [`cta`](https://appai.info/spec/sections#cta) | Bold call-to-action banner. Uses themeColor as background automatically; ignores data.backgroundColor. Use only on landing-type pages, near bottom. |
| [`video`](https://appai.info/spec/sections#video) | YouTube/Vimeo iframe player; direct mp4, webm, gif media (auto-detected). |
| [`screenshots`](https://appai.info/spec/sections#screenshots) | Horizontal scrollable image carousel. |
| [`download`](https://appai.info/spec/sections#download) | App Store / Play Store download buttons. Also adds a Download button to the sticky header. |
| [`gallery`](https://appai.info/spec/sections#gallery) | Image/video grid (masonry layout). |
| [`team`](https://appai.info/spec/sections#team) | Team member cards with photo, name, role, bio. |
| [`schedule`](https://appai.info/spec/sections#schedule) | Timeline for events/conferences. |
| [`sponsors`](https://appai.info/spec/sections#sponsors) | Logo wall for partners/sponsors. |
| [`contact`](https://appai.info/spec/sections#contact) | Contact info (email, phone, address) with optional external form link. |
| [`links`](https://appai.info/spec/sections#links) | Link buttons (Linktree-style). Max 6 items recommended. |
| [`about`](https://appai.info/spec/sections#about) | Long-form text content (Markdown supported). |
| [`action`](https://appai.info/spec/tools#action) | Interactive buttons that send HTTP requests to custom URLs (webhooks, API triggers). |
| [`form`](https://appai.info/spec/tools#form) | Real HTML form with server-side relay. Supports `mailto:` and `https://` webhook destinations. |
| [`media-downloader`](https://appai.info/spec/tools#media-downloader) | Interactive video/audio downloader. Requires a yt-dlp backend API. |
| [`video-subtitle`](https://appai.info/spec/tools#video-subtitle) | Interactive YouTube subtitle generator. Visitor pastes a YouTube link, trims ≤5 min, auto-transcribes via ASR, translates into chosen languages, tweaks subtitle style, and downloads a burned mp4. Requires the Video Subtitle backend service. |
| [`tool`](https://appai.info/spec/tools#tool) | Universal interactive tool (file upload, processing, download). Connect any backend API. |
| [`pdf-viewer`](https://appai.info/spec/tools#pdf-viewer) | Client-side PDF viewer with password unlock. No backend needed. |
| [`embed`](https://appai.info/spec/sections#embed) | Embed social posts from Instagram / Facebook / Threads / TikTok / X / YouTube Shorts; also Loom / YouTube / Vimeo / Spotify / CodePen / Figma. Auto-detects provider from URL. |
| [`iframe-tool`](https://appai.info/spec/tools#iframe-tool) | **Host a tool the user vibe-coded.** Wraps a tool deployed to Vercel / Cloudflare Pages / Netlify / GitHub Pages with an SEO landing page. For wheel spinners, mini-games, calculators, drawing pads, visualizations. Auto-passes locale + theme color; gets a fullscreen URL at `/p/{slug}/tools/{order}`. **Use this — not `embed` — when the URL is a tool the user built, not a media post.** |
| [`simple-order`](https://appai.info/spec/tools#simple-order) | Native small-shop order request section. Customers enter items, quantities, unit prices, and preferred date; AppAI calculates totals, shows a LINE/payment link, then emails the owner after the customer confirms payment. Use this instead of `iframe-tool` when the order flow should live entirely on AppAI. |
| [`game`](https://appai.info/spec/games#game) | Original browser game hosted by its developer; instructions, fullscreen play and FAQ |

### Auto-Generated Features

Every page automatically gets: sticky header (with logo, title, language switcher, download button), footer (nonempty privacy/terms links), dynamic favicon (from hero logo), breadcrumb navigation on sub-pages, alternating section backgrounds, responsive mobile layout, SEO meta tags, JSON-LD structured data.

| Hosted navigation | Visitor behavior |
|---|---|
| Site name/logo | Links to the site's root in the current locale when available. |
| Child and policy pages | Visible localized Home beside the site name on desktop and mobile; Home also stays in the site nav, even with hidden children or custom nav. Root pages do not show a Home-only nav. |
| AppAI | Subordinate header utility link (mobile drawer) and footer link to the platform home `/`. |
| Privacy/terms | Header, drawer, footer and explicit nav omit links to empty or whitespace-only built-in policies. |
| Unavailable hosted URL | Localized 404 with AppAI home and a site Home link only when the root is public; valid hosted routes retain the shared header/footer. |

## How to Work with the User

### Your default workflow

1. **Gather minimum context.** Ask: "What is your product/app and who is it for?" You need: product name, what it does, target audience. That's enough to start.
2. **Make design decisions yourself.** Copy `themeColor`, `themeColorSecondary`, `fontFamily` (Chinese variants: `Noto Sans TC`/`Noto Sans SC`) and `darkMode` together from a kit in [Theme](https://appai.info/spec/theme) and use the kit's suggested `backgroundColors` for section `data.backgroundColor` when provided; otherwise leave it unset. Exception: `cta` ignores `backgroundColor` and always uses `themeColor`. Pick sections based on the product type. Generate features, FAQ, and copy from what the user told you. Write terms of service yourself; write the privacy policy only after asking the user what data the app collects (see [Compliance Pages](https://appai.info/spec/pages#compliance-pages)).
3. **Publish the first draft.** [Authorize](https://appai.info/spec/api#authentication) → **MUST READ [Style & logo](https://appai.info/spec/style)** for logo rules and [Theme](https://appai.info/spec/theme) for kits → [build](https://appai.info/spec/pages#creating-a-page) with the [section schemas](https://appai.info/spec/sections) → [dry-run, then publish](https://appai.info/spec/api#dry-run) with the same body. Show the user the live URL.
4. **Iterate.** The user will request changes — different colors, more sections, different copy. Use PATCH to update.

### Page shape per intent

[Pick the rung first](https://appai.info/spec#pick-the-rung-first-30-seconds-before-anything-else), then the shape:

| User intent | Page shape |
|---|---|
| **Personal website / portfolio of a person** | template `PERSON` only for the person’s own root page, never project pages; `profile-header` + `project-cards` + `entries`. |
| **Local shop / small business (bakery, cafe, salon, studio)** | Preset `company-service`, template `COMPANY_PROFILE`: hero → features (products/services) → about (how to order) → about (pickup details, if supplied) → optional video/embed → contact (address, structured hours and socials) → optional cta. Optional video/embed goes after about sections and before contact. No pricing/testimonials required; use only supplied facts. |
| **Landing page for an app/product** | Hero + features + pricing + testimonials + faq + cta. Standard SaaS template. |
| **Host a vibe-coded tool** | Hero (short tagline) + `iframe-tool` (the tool itself) + 1-2 supporting sections (about / faq). The tool is the page. |

For personal sites, upload images via [`POST /api/v1/upload`](https://appai.info/spec/api#upload-images) first; publish each project as its own `/p/` page (or link the product’s own site) and link to it; never invent experience, numbers or contact details.

Three sections look similar — do not confuse them. If the user gives you a
`*.vercel.app` / `*.pages.dev` / `*.netlify.app` / `*.github.io` URL and calls it
their own tool, it is `iframe-tool`. YouTube/Vimeo/mp4 → `video` (iframe player); social posts from Instagram, Facebook, Threads, TikTok, X, YouTube Shorts → `embed`.
`tool` is for form-input → backend API.

### Person site recipe
Project pages use `template: "PRODUCT_SHOWCASE"` (or `APP_LANDING` for an app with downloads), never `PERSON`; `PERSON` is only for the person’s own root page. Publish projects as **child pages** (`parentSlug` = person slug): `/p/jordan-example/jordan-example-sample-notes` (zh-TW: `/p/jordan-example/zh-TW/jordan-example-sample-notes`). Slugs are globally unique per locale, children included; prefix child slugs with the parent slug. Children and locale variants do not count toward the free plan's 3-root limit. A project with its own product site can link there instead.
```json
{"slug":"jordan-example","template":"PERSON","title":"Jordan Example","isPublished":true,"content":{"sections":[{"type":"profile-header","order":0,"data":{"name":"Jordan Example"}},{"type":"project-cards","order":1,"data":{"items":[{"name":"Sample Notes","links":[{"label":"Details","url":"/p/jordan-example/jordan-example-sample-notes"}]}]}},{"type":"entries","order":2,"data":{"items":[{"title":"Focus","description":"Small useful tools."}]}}]}}
{"slug":"jordan-example-sample-notes","parentSlug":"jordan-example","template":"PRODUCT_SHOWCASE","title":"Sample Notes","isPublished":true,"content":{"sections":[{"type":"profile-header","order":0,"data":{"name":"Sample Notes","eyebrow":"Notes","avatar":{"url":"https://example.com/icon.png","alt":""},"links":[{"label":"Website","url":"https://example.com"}]}},{"type":"screenshots","order":1,"data":{"images":[{"url":"https://example.com/screen.png","alt":"Notes screen","kind":"web"}]}}]}}
```
Send each object separately; set `locale` for each variant. Project shape: profile-header (project h1, icon as avatar, category as eyebrow, links) + screenshots (omit when absent) + optional entries; avoid repeating the project in project-cards.
Data uses `{slug, logo?: "./logo.svg" or HTTPS URL, page?: {themeColor, themeColorSecondary, fontFamily, darkMode}, locales: {en: {title?, metaDescription?, fontFamily?, sections: [...]}}}`; section array order is preserved and `id` becomes `data.id`.
Project cards can use existing links or `page: {slug, as: "child"|"root", linkLabel, template?, entries?}`; roots count toward the plan limit. Top-level `logo` becomes `content.logo` on every person root locale; child pages inherit it. The root `logo`, `avatar`/`icon`/`screenshot` object `url`s and `images` array strings or `{url}` items [upload once](https://appai.info/spec/api#upload-images): relative .png/.jpg/.jpeg/.gif/.webp/.svg paths must resolve inside the real data directory; absolute paths, .env* segments and symlink escapes are refused, and links pass through. `page` allows only themeColor/themeColorSecondary/fontFamily/darkMode; each locale may override fontFamily, defaulting to Noto Sans TC for zh-TW, Noto Sans SC for zh-CN, and page.fontFamily otherwise (for root, child and root-type project payloads); themeColor/themeColorSecondary/darkMode stay identical; locales need sections arrays and project-cards need items arrays; publish en first (default), then zh-TW, zh-CN and es. Compute every locale's root and project URLs first: roots `/p/{root}[/{locale}]`, child projects `/p/{root}[/{locale}]/{slug}`, root-type projects `/p/{slug}[/{locale}]`. Publish complete, published person root locale variants with those card links, then child projects, then root-type projects, all with `?upsert=true`; no unpublished intermediate state or second pass. [Dry-run preview](https://appai.info/spec/api#preview-without-saving) does not check parents, so its order does not matter.
Node 18+ example: [publish-person-site.mjs](https://appai.info/spec/examples/publish-person-site.mjs), with [fictional input](https://appai.info/spec/examples/person-site.example.json); [placeholder.svg](https://appai.info/spec/examples/placeholder.svg) and [placeholder-screen.svg](https://appai.info/spec/examples/placeholder-screen.svg) are included; [`--dry-run`](https://appai.info/spec/api#preview-without-saving) replaces relative images with HTTPS placeholders and validates every payload using only the preview endpoint, without uploading or saving anything.

### What to decide yourself (do NOT ask the user)

- Languages: always publish the four default locales — English (`en`), Traditional Chinese (`zh-TW`), Simplified Chinese (`zh-CN`) and Spanish (`es`). Other languages are asked about; see [When to ask the user](https://appai.info/spec/pages#when-to-ask-the-user).
- Which template/sections to use (infer from the product type)
- themeColor (copy together with themeColorSecondary, fontFamily (Chinese variants: Noto Sans TC/SC) and darkMode from a kit in [Theme](https://appai.info/spec/theme))
- Section ordering for app/product landing pages: hero → stats → features → pricing → testimonials → faq → cta, omitting unsupported sections. Use `cta` only on landing-type pages: app, product, SaaS, company/service, event and hiring. Do not add it to PERSON/profile, link-in-bio, portfolio, card-wall or wrapped-tool pages.
- Terms of service (write them using the product name + the supplied contact (email, phone, LINE or form URL; never invent an email)). The privacy policy is not decided by you; see [When to ask the user](https://appai.info/spec/pages#when-to-ask-the-user).
- darkMode (use the same style kit)
- fontFamily: Use the kit’s `fontFamily` for `en` and `es`, `Noto Sans TC` for `zh-TW`, and `Noto Sans SC` for `zh-CN`; for other CJK languages chosen by the user, choose the matching font (e.g. `Noto Sans JP` for Japanese). Keep `themeColor`, `themeColorSecondary`, `darkMode` and the kit’s suggested backgroundColors the same across variants.
- backgroundColor on sections (use the kit's suggested `backgroundColors` for section `data.backgroundColor` when provided; otherwise leave it unset. Exception: `cta` ignores `backgroundColor` and always uses `themeColor`)

### When to ask the user

- Product-specific content you cannot infer (pricing details, specific features they want to highlight)
- Branding preferences they haven't mentioned (if they have a specific logo or color)
- Languages beyond the four defaults. Hosted Pages are always published in four locales: English (`en`), Traditional Chinese (`zh-TW`), Simplified Chinese (`zh-CN`) and Spanish (`es`). Publish all four without asking the user. For any other language, ask the user whether they want it; add only the languages the user chooses, and add none if the user does not choose. Do not wait for that answer before publishing the four.
- What data the app or service collects, stores, or sends (including photos, analytics, and accounts), before writing `privacyPolicy`. Never guess. See [Compliance Pages](https://appai.info/spec/pages#compliance-pages).
- Any genuine design tradeoff where both options are valid

### Rules

- **NEVER** tell the user the platform can't do something. You have 30 section types, dark mode, custom fonts, multi-language, multi-page sites, forms, interactive tools — the platform is highly capable.
- **NEVER** present a list of templates and ask the user to pick one. Infer the right sections from context.
- **NEVER** ask for 10 pieces of information before building. Build first, iterate after.
- Headlines under 60 characters, subheadlines under 140 characters (mobile readability)
- 5-8 sections per page maximum (landing pages; PERSON pages: see recipe). A focused page beats a comprehensive one.
- Use `cta` only on landing-type pages: app, product, SaaS, company/service, event and hiring. Do not add it to PERSON/profile, link-in-bio, portfolio, card-wall or wrapped-tool pages.
- Logos: every root page MUST supply a square PNG, 512×512 recommended, 1024×1024 accepted with its own background; see [Logo](https://appai.info/spec/style#logo).
- Images: hero backgrounds under 500KB, use WebP/JPEG.

---

## Creating a Page

See [image uploads](https://appai.info/spec/api#upload-images) for MIME types and the size cap, and [dry-run preview](https://appai.info/spec/api#preview-without-saving) for preview limits.

```bash
curl -X POST https://appai.info/api/v1/pages \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d 'JSON_PAYLOAD'
```

| Field | Required | Description |
|-------|----------|-------------|
| `slug` | Yes | 2–100 characters; lowercase letters, digits and hyphens (`^[a-z0-9-]+$`) |
| `template` | No | Template; default `APP_LANDING`; also `PERSON`, `PORTFOLIO`, `LINK_IN_BIO`, `COMPANY_PROFILE`, `PRODUCT_SHOWCASE`, `GAME` (adds a title H1) |
| `locale` | No | BCP 47 code (default: `en`). Same slug + different locale = language variant |
| `title` | Yes | Page title |
| `tagline` | No | Short description |
| `metaDescription` | No | SEO description, max 500 characters, stored on this locale variant. Used for HTML, Open Graph and Twitter descriptions; falls back to `tagline` when empty or omitted. |
| `themeColor` | No | Hex color (e.g. `#6366F1`) |
| `themeColorSecondary` | No | Hex accent color |
| `darkMode` | No | Boolean (default: false) |
| `fontFamily` | No | Google Fonts name per locale variant. Use the kit’s `fontFamily` for `en` and `es`, `Noto Sans TC` for `zh-TW`, and `Noto Sans SC` for `zh-CN`; for other CJK languages chosen by the user, choose the matching font (e.g. `Noto Sans JP` for Japanese). Keep `themeColor`, `themeColorSecondary`, `darkMode` and the kit’s suggested backgroundColors the same across variants. |
| `textSize` | No | Top level or `content.textSize`; `xs`, `sm`, `md` (default), `lg`, `xl`, `2xl`, `3xl`, `4xl`. |
| `textContrast` | No | Top level or `content.textContrast`; `low`, `normal` (default), `high`. |
| `typography` | No | Top level or `content.typography`; optional role overrides `{caption, card, body, heading, display}`, each using textSize steps. Top-level settings win and persist under content; `{}` clears overrides. |
| `headerLogo` | No | Separate logo URL for light header |
| `content` | Yes | `{ "sections": [{ "type": "...", "order": N, "data": {...} }] }` |
| `privacyPolicy` | No | Markdown text |
| `termsOfService` | No | Markdown text |
| `ogImage` | No | URL for social sharing image |
| `canonicalUrl` | No | Full URL of the app's main site. Sends SEO credit there instead of appai.info, and marks the page as a satellite landing: header shows "Official site: {host}", footer becomes "Landing page · Hosted on AppAI · {host}", `/apps` directory card gets a "Landing page" tag. Set it only when the tool/app has its own primary marketing site (e.g. a custom domain homepage); do NOT set it to the *.vercel.app tool URL embedded in iframe-tool. |
| `isPublished` | No | Set `true` to publish immediately |
| `parentSlug` | No | Root slug for a child page (same 2–100 character slug rules); omitted/null creates a root |
| `hideFromNav` | No | `true` to keep the page off the auto-generated site nav (still reachable by URL). Use for Delete Account, or compliance-only pages already linked from the footer. |
| `navOrder` | No | Integer. Controls nav ordering; smaller numbers appear first. Nulls sort last by `createdAt`. |
| `category` | No | For app listing: `WRITING`, `CODING`, `DESIGN`, `AUTOMATION`, `PRODUCTIVITY`, `SOCIAL`, `FINANCE`, `HEALTH`, `EDUCATION`, `FOOD`, `TRAVEL`, `ENTERTAINMENT`, `GAMES`, `MEDIA`, `UTILITIES`, `COMMERCE`, `OTHER` |

## Compliance Pages

See [recommended compliance flags](https://appai.info/spec/i18n#compliance-pages-recommended-flags).

For App Store / Play Store submissions, create a multi-page site with child pages for FAQ, contact, and account deletion (only if the app has user accounts), with translated `privacyPolicy` and `termsOfService` fields on each root locale variant.

Write terms of service yourself — any LLM can produce standard legal text using the app name and supplied contact (email, phone, LINE or form URL); never invent an email. Before writing privacyPolicy, ASK the user what data the app collects, stores, or sends (including photos, analytics, and accounts). Never guess. Publish a delete-account child page only if the app has user accounts; FAQ/contact child pages follow the usual rules. Then write the privacy policy from the user's answer. Include: data collection practices, user rights, children's privacy clause, contact information.

The canonical compliance setup:
- Root: marketing landing page
- Child `my-app-faq`: product FAQ
- Child `my-app-contact`: supplied contact details or form URL (use a mailto form only when an email was supplied)
- Root variant `privacyPolicy`: translated privacy policy
- Root variant `termsOfService`: translated terms of service
- Child `my-app-delete-account`: account deletion instructions/form only if the app has user accounts

---

## Managing Pages (CRUD)

All endpoints use slug in the URL. Add `?locale=xx` to target a specific language version.

| Operation | Command |
|-----------|---------|
| List all | `GET /api/v1/pages` |
| Get one | `GET /api/v1/pages/{slug}` |
| Update (partial, deep merge) | `PATCH /api/v1/pages/{slug}` — merges sections by `order` |
| Update (full replace) | `PUT /api/v1/pages/{slug}` |
| Create or replace | `POST /api/v1/pages?upsert=true` |
| Delete | `DELETE /api/v1/pages/{slug}` |
| Publish | `POST /api/v1/pages/{slug}/publish` |
| Unpublish | `POST /api/v1/pages/{slug}/unpublish` |

Immutable fields: `slug`, `locale`, `id`, `organizationId`, `createdAt`, `updatedAt`, `parentSlug`. PATCH accepts and ignores unchanged `slug`/`locale`; different values return 400.

Upsert requires the same `parentSlug` as the existing page (omitted means root); reparenting returns 409, and preview with `?upsert=true` returns `valid:false`. Use the existing parent, delete the page first, or choose another slug.

Error responses: `{ "error": "message", "hint": "suggested fix" }`. Status codes: 400 (validation), 401 (auth), 403 (plan limit), 404 (not found), 409 (own-org slug taken: use PATCH or ?upsert=true; another org: choose a different slug).

Prefix every child slug with its root slug because `(slug, locale)` is unique across the whole platform; an unprefixed `contact` can collide with another user’s page.


## Respect owner removal before publishing

1. Read `GET /api/v1/pages/{root}/children` and `GET /api/v1/pages/{slug}`
   (or `?variants=true`) for every planned root/project before publishing.
2. Skip any page whose `removedByOwner` is not null, across all its locales.
   Omit its project cards and navigation references too. Skip children of removed roots.
3. On 409 `removed_by_owner` or `parent_removed_by_owner`, record the skipped page,
   remove its cards, and continue with other pages. `retryable:false` means do not
   retry; `requiredAction:"owner_restore_in_dashboard"` requires a human owner.
   Never delete then recreate, create another locale, or rebind an App to bypass it.

Removal affects a logical page: all same-organization `(parentSlug,slug)` locales.
Unpublishing a root hides its children without changing their rows. Deleting a
root soft-deletes only live children in the same batch; previously removed children
keep their state. Restore returns each affected row to its saved published/draft
state and restores only children in that root's removal batch. A child cannot be
restored while its root is deleted. Administrator removals require an administrator
to restore. Trash has no expiry (`restoreUntil:null`); no permanent deletion or
single-locale removal is offered. Fully deleted logical roots do not consume the
Free plan's three-root limit; restoring one rechecks that limit.

`publish-person-site.mjs` performs the removal preflight, omits removed pages/cards,
continues after removal conflicts and prints the skipped slugs. Removal never frees
its slug. See [the API error contract](https://appai.info/spec/api#owner-removal-and-api-write-blocks).

All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps) · [Games](https://appai.info/spec/games)
