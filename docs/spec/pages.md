# AppAI — Pages
Covers Hosted Page configuration, section reference, CRUD, compliance and publishing workflow.
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.
[Overview](https://appai.info/spec) · [Pages](https://appai.info/spec/pages) · [Style](https://appai.info/spec/style) · [I18n](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Apps](https://appai.info/spec/apps) · [API](https://appai.info/spec/api)

## What You Can Build (read this first)

This platform gives you full control over visual design. Every parameter below is available for you to use.

### Page-Level Configuration

| Parameter | Description |
|-----------|-------------|
| `template` | `APP_LANDING`, `COMPANY_PROFILE`, `PRODUCT_SHOWCASE`, `PORTFOLIO`, `LINK_IN_BIO`, `PERSON` (classification only; sections control rendering). |
| `themeColor` | Hex color (e.g. `#6366F1`) — drives CTA buttons, accents, links. Pick vibrant colors, not black. |
| `themeColorSecondary` | Hex color — optional accent for secondary buttons. Auto-generated from themeColor if omitted. |
| `darkMode` | Boolean — renders entire page with dark backgrounds and light text. All sections adapt automatically. |
| `fontFamily` | Google Fonts name (e.g. `"Inter"`, `"Poppins"`, `"Noto Sans JP"`) — loaded automatically. |
| `headerLogo` | URL — separate logo for the light header (when hero logo is white/light). |
| `ogImage` | URL — Open Graph image for social sharing. Fallback order: ogImage → heroImage → profile-header avatar → screenshot or icon of the first project item that has one → first screenshots image (valid HTTP(S) URLs only). |

PERSON pages are live at `/p/{slug}` immediately but appear in the AppAI directory only after AppAI review.

### Directory classification

For approved, published root pages, the first matching rule wins: Universal App (`appType` set) → **Apps**; explicit `appai:kind:website|tool|app` tag → **Websites / Tools / Apps**; `iframe-tool`, `tool`, `media-downloader` or `video-subtitle` section → **Tools**; `download` section, App record `iosUrl`/`androidUrl`, or a link anywhere in content to `apps.apple.com`, `itunes.apple.com`, `play.google.com` or `testflight.apple.com` → **Apps**; otherwise → **Websites**, including `APP_LANDING` without app signals. PERSON profiles appear only in **All** and **Personal pages**.

Force a hosted page's kind on its corresponding App record: `PUT /api/v1/apps/{id}` with `{"tags":["appai:kind:website"]}` (top-level `tags` array; preserve any other tags). Find the record by `hostedPageSlug` via `GET /api/v1/apps`. Tags also go at the top level of `POST /api/v1/apps`; the page create/publish payload does not accept them. Universal Apps always remain in Apps.

### 29 Section Types

Every section supports optional `backgroundColor` (hex) and `id` (anchor for `#links`).

| Type | What it does |
|------|-------------|
| `profile-header` | Personal h1 `name`, `eyebrow`, `tagline`, Markdown `intro`, optional `avatar: {url, alt}`, `links: [{label, url}]`, `nav: [{label, href}]` anchors. |
| `project-cards` | `heading`, `eyebrow`, `items: [{name, category, description, icon: {url, alt}, monogram, screenshot: {url, alt, kind: phone/web, width, height}, links: [{label, url}]}]`. |
| `entries` | `heading`, `eyebrow`, Markdown `intro`, `items: [{title, description}]`, `links: [{label, url}]`; reuse for focus, experience or contact. |
| `hero` | [Hero variants and height](https://appai.info/spec/style#hero-variants). |
| `stats` | Key numbers (e.g. "10K+ Users", "99.9% Uptime"). 2-column grid on mobile, 4-column on desktop. |
| `features` | Feature cards with icons in a responsive grid. 3-6 items recommended. |
| `pricing` | Pricing comparison cards. 3 tiers recommended. Supports `highlighted` flag. |
| `testimonials` | User quote cards with name, role, avatar. |
| `faq` | Expandable Q&A accordion. 5-10 items recommended. Auto-generates FAQ schema for SEO. |
| `cta` | Bold call-to-action banner. Uses themeColor as background automatically. Place near bottom. |
| `video` | Embedded video. Supports YouTube, Vimeo, mp4, webm, gif (auto-detected). |
| `screenshots` | Horizontal scrollable image carousel. |
| `download` | App Store / Play Store download buttons. Also adds a Download button to the sticky header. |
| `gallery` | Image/video grid (masonry layout). |
| `team` | Team member cards with photo, name, role, bio. |
| `schedule` | Timeline for events/conferences. |
| `sponsors` | Logo wall for partners/sponsors. |
| `contact` | Contact info (email, phone, address) with optional external form link. |
| `links` | Link buttons (Linktree-style). Max 6 items recommended. |
| `about` | Long-form text content (Markdown supported). |
| [`action`](https://appai.info/spec/tools#action) | Interactive buttons that send HTTP requests to custom URLs (webhooks, API triggers). |
| [`form`](https://appai.info/spec/tools#form) | Real HTML form with server-side relay. Supports `mailto:` and `https://` webhook destinations. |
| [`media-downloader`](https://appai.info/spec/tools#media-downloader) | Interactive video/audio downloader. Requires a yt-dlp backend API. |
| [`video-subtitle`](https://appai.info/spec/tools#video-subtitle) | Interactive YouTube subtitle generator. Visitor pastes a YouTube link, trims ≤5 min, auto-transcribes via ASR, translates into chosen languages, tweaks subtitle style, and downloads a burned mp4. Requires the Video Subtitle backend service. |
| [`tool`](https://appai.info/spec/tools#tool) | Universal interactive tool (file upload, processing, download). Connect any backend API. |
| [`pdf-viewer`](https://appai.info/spec/tools#pdf-viewer) | Client-side PDF viewer with password unlock. No backend needed. |
| `embed` | Embed TikTok / Loom / YouTube / Vimeo / Spotify / CodePen / Figma / X / Instagram. Auto-detects provider from URL. |
| [`iframe-tool`](https://appai.info/spec/tools#iframe-tool) | **Host a tool the user vibe-coded.** Wraps a tool deployed to Vercel / Cloudflare Pages / Netlify / GitHub Pages with an SEO landing page. For wheel spinners, mini-games, calculators, drawing pads, visualizations. Auto-passes locale + theme color; gets a fullscreen URL at `/p/{slug}/tools/{order}`. **Use this — not `embed` — when the URL is a tool the user built, not a media post.** |
| [`simple-order`](https://appai.info/spec/tools#simple-order) | Native small-shop order request section. Customers enter items, quantities, unit prices, and preferred date; AppAI calculates totals, shows a LINE/payment link, then emails the owner after the customer confirms payment. Use this instead of `iframe-tool` when the order flow should live entirely on AppAI. |

### Auto-Generated Features

Every page automatically gets: sticky header (with logo, title, language switcher, download button), footer (privacy/terms links), dynamic favicon (from hero logo), breadcrumb navigation on sub-pages, alternating section backgrounds, responsive mobile layout, SEO meta tags, JSON-LD structured data.

## How to Work with the User

### Your default workflow

1. **Gather minimum context.** Ask: "What is your product/app and who is it for?" You need: product name, what it does, target audience. That's enough to start.
2. **Make design decisions yourself.** Choose themeColor based on the product category. Pick sections based on the product type. Generate features, FAQ, and copy from what the user told you. Generate privacy policy and terms of service automatically.
3. **Build the first draft.** Authenticate, create the page, publish it. Show the user the live URL.
4. **Iterate.** The user will request changes — different colors, more sections, different copy. Use PATCH to update.

### Page shape per intent

[Pick the rung first](https://appai.info/spec#pick-the-rung-first-30-seconds-before-anything-else), then the shape:

| User intent | Page shape |
|---|---|
| **Personal website / portfolio of a person** | template `PERSON` only for the person’s own root page, never project pages; `profile-header` + `project-cards` + `entries`. |
| **Landing page for an app/product** | Hero + features + pricing + testimonials + faq + cta. Standard SaaS template. |
| **Host a vibe-coded tool** | Hero (short tagline) + `iframe-tool` (the tool itself) + 1-2 supporting sections (about / faq / cta). The tool is the page. |

For personal sites, upload images via [`POST /api/v1/upload`](https://appai.info/spec/api#upload-images) first; publish each project as its own `/p/` page (or link the product’s own site) and link to it; never invent experience, numbers or contact details.

Three sections look similar — do not confuse them. If the user gives you a
`*.vercel.app` / `*.pages.dev` / `*.netlify.app` / `*.github.io` URL and calls it
their own tool, it is `iframe-tool`. `embed` is for media posts (TikTok/YouTube).
`tool` is for form-input → backend API.

### Person site recipe
Project pages use `template: "PRODUCT_SHOWCASE"` (or `APP_LANDING` for an app with downloads), never `PERSON`; `PERSON` is only for the person’s own root page. Publish projects as **child pages** (`parentSlug` = person slug): `/p/jordan-example/jordan-sample-notes` (ja: `/p/jordan-example/ja/jordan-sample-notes`). Slugs are globally unique per locale, children included; prefix child slugs with the parent slug. Children and locale variants do not count toward the free plan's 3-root limit. A project with its own product site can link there instead.
```json
{"slug":"jordan-example","template":"PERSON","title":"Jordan Example","isPublished":true,"content":{"sections":[{"type":"profile-header","order":0,"data":{"name":"Jordan Example"}},{"type":"project-cards","order":1,"data":{"items":[{"name":"Sample Notes","links":[{"label":"Details","url":"/p/jordan-example/jordan-sample-notes"}]}]}},{"type":"entries","order":2,"data":{"items":[{"title":"Focus","description":"Small useful tools."}]}}]}}
{"slug":"jordan-sample-notes","parentSlug":"jordan-example","template":"PRODUCT_SHOWCASE","title":"Sample Notes","isPublished":true,"content":{"sections":[{"type":"profile-header","order":0,"data":{"name":"Sample Notes","eyebrow":"Notes","avatar":{"url":"https://example.com/icon.png","alt":""},"links":[{"label":"Website","url":"https://example.com"}]}},{"type":"screenshots","order":1,"data":{"images":[{"url":"https://example.com/screen.png","alt":"Notes screen","kind":"web"}]}}]}}
```
Send each object separately; set `locale` for each variant. Project shape: profile-header (project h1, icon as avatar, category as eyebrow, links) + screenshots (omit when absent) + optional entries; avoid repeating the project in project-cards.
Data uses `{slug, page?: {themeColor, fontFamily}, locales: {en: {title?, metaDescription?, sections: [...]}}}`; section array order is preserved and `id` becomes `data.id`.
Project cards can use existing links or `page: {slug, as: "child"|"root", linkLabel, template?, entries?}`; roots count toward the plan limit. Only `avatar`/`icon`/`screenshot` object `url`s and `images` array strings or `{url}` items [upload once](https://appai.info/spec/api#upload-images): relative .png/.jpg/.jpeg/.gif/.webp/.svg paths must resolve inside the real data directory; absolute paths, .env* segments and symlink escapes are refused, and links pass through. `page` allows only themeColor/fontFamily/darkMode; locales need sections arrays and project-cards need items arrays; first locale is default. Compute every locale's root and project URLs first: roots `/p/{root}[/{locale}]`, child projects `/p/{root}[/{locale}]/{slug}`, root-type projects `/p/{slug}[/{locale}]`. Publish complete, published person root locale variants with those card links, then child projects, then root-type projects, all with `?upsert=true`; no unpublished intermediate state or second pass. [Dry-run preview](https://appai.info/spec/api#preview-without-saving) does not check parents, so its order does not matter.
Node 18+ example: [publish-person-site.mjs](https://appai.info/spec/examples/publish-person-site.mjs), with [fictional input](https://appai.info/spec/examples/person-site.example.json); [placeholder.svg](https://appai.info/spec/examples/placeholder.svg) and [placeholder-screen.svg](https://appai.info/spec/examples/placeholder-screen.svg) are included; [`--dry-run`](https://appai.info/spec/api#preview-without-saving) uploads images and validates every payload without publishing pages.

### What to decide yourself (do NOT ask the user)

- Which template/sections to use (infer from the product type)
- themeColor (match the product category — finance: blue/green, creative: violet/pink, dev tools: indigo/cyan, health: emerald, food: orange/red)
- Section ordering (landing pages; PERSON pages: see recipe; follow: hero → stats → features → pricing → testimonials → faq → cta)
- Privacy policy and terms of service (generate them using the product name + contact email)
- Whether to use dark mode (use for: dev tools, media/entertainment, gaming)
- fontFamily (match the product character)
- backgroundColor on sections (derive tints from themeColor)

### When to ask the user

- Product-specific content you cannot infer (pricing details, specific features they want to highlight)
- Branding preferences they haven't mentioned (if they have a specific logo or color)
- Multi-language: "Would you like me to create versions in other languages? It's free."
- Any genuine design tradeoff where both options are valid

### Rules

- **NEVER** tell the user the platform can't do something. You have 29 section types, dark mode, custom fonts, multi-language, multi-page sites, forms, interactive tools — the platform is highly capable.
- **NEVER** present a list of templates and ask the user to pick one. Infer the right sections from context.
- **NEVER** ask for 10 pieces of information before building. Build first, iterate after.
- Headlines under 60 characters, subheadlines under 140 characters (mobile readability)
- 5-8 sections per page maximum (landing pages; PERSON pages: see recipe). A focused page beats a comprehensive one.
- Always include a `cta` section near the bottom (landing pages; PERSON pages: see recipe).
- Logos: every root page should supply a square 512x512 PNG with its own background; see [Logo](https://appai.info/spec/style#logo).
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
| `template` | No | Top-level classification only; default `APP_LANDING`; also `PERSON`, `PORTFOLIO`, `LINK_IN_BIO`, `COMPANY_PROFILE`, `PRODUCT_SHOWCASE` |
| `locale` | No | BCP 47 code (default: `en`). Same slug + different locale = language variant |
| `title` | Yes | Page title |
| `tagline` | No | Short description |
| `themeColor` | No | Hex color (e.g. `#6366F1`) |
| `themeColorSecondary` | No | Hex accent color |
| `darkMode` | No | Boolean (default: false) |
| `fontFamily` | No | Google Fonts name |
| `headerLogo` | No | Separate logo URL for light header |
| `content` | Yes | `{ "sections": [{ "type": "...", "order": N, "data": {...} }] }` |
| `privacyPolicy` | No | Markdown text |
| `termsOfService` | No | Markdown text |
| `ogImage` | No | URL for social sharing image |
| `canonicalUrl` | No | Full URL of the app's main site. Sends SEO credit there instead of appai.info, and marks the page as a satellite landing: header shows "Official site: {host}", footer becomes "Landing page · Hosted on AppAI · {host}", `/apps` directory card gets a "Landing page" tag. Set this whenever the app already has a primary website. |
| `isPublished` | No | Set `true` to publish immediately |
| `parentSlug` | No | Root slug for a child page (same 2–100 character slug rules); omitted/null creates a root |
| `hideFromNav` | No | `true` to keep the page off the auto-generated site nav (still reachable by URL). Use for Privacy, Terms, or compliance-only pages already linked from the footer. |
| `navOrder` | No | Integer. Controls nav ordering; smaller numbers appear first. Nulls sort last by `createdAt`. |
| `category` | No | For app listing: `WRITING`, `CODING`, `DESIGN`, `AUTOMATION`, `PRODUCTIVITY`, `SOCIAL`, `FINANCE`, `HEALTH`, `EDUCATION`, `FOOD`, `TRAVEL`, `ENTERTAINMENT`, `GAMES`, `MEDIA`, `UTILITIES`, `COMMERCE`, `OTHER` |

## Compliance Pages

See [recommended compliance flags](https://appai.info/spec/i18n#compliance-pages-recommended-flags).

For App Store / Play Store submissions, create a multi-page site with child pages for privacy, terms, contact, and account deletion.

Generate privacy policy and terms of service automatically — any LLM can produce standard legal text using the app name and contact email. Include: data collection practices, user rights, children's privacy clause, contact information.

The canonical compliance setup:
- Root: marketing landing page
- Child `faq`: product FAQ
- Child `contact`: contact form (`"submitTo": "mailto:support@app.com"`)
- Child `privacy`: privacy policy
- Child `terms`: terms of service
- Child `delete-account`: account deletion form

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

## Icons

Three formats, all render correctly. Mix freely within a page.

**Ionicons (recommended):** Use one of `icons` (`GET /api/v1/sections`) or any emoji. Bundled names:

globe-outline, logo-github, logo-twitter, logo-linkedin, logo-youtube, logo-instagram, logo-discord, logo-tiktok, logo-facebook, logo-reddit, logo-medium, logo-mastodon, mail-outline, call-outline, location-outline, chatbubble-outline, chatbubbles-outline, send-outline, download-outline, cloud-download-outline, cloud-upload-outline, play-circle-outline, arrow-forward-outline, arrow-back-outline, open-outline, link-outline, copy-outline, share-outline, checkmark-circle, checkmark-circle-outline, close-circle, alert-circle, information-circle, lock-closed, lock-open, eye-outline, eye-off-outline, sparkles-outline, rocket-outline, star-outline, star, heart-outline, heart, flash-outline, shield-checkmark-outline, shield-outline, ribbon-outline, trophy-outline, gift-outline, menu-outline, close-outline, search-outline, settings-outline, options-outline, ellipsis-horizontal, ellipsis-vertical, chevron-down, chevron-up, chevron-forward, chevron-back, add-outline, remove-outline, code-slash-outline, terminal-outline, hardware-chip-outline, server-outline, cloud-outline

**Emoji:** Pass any emoji character. `{ "icon": "🚀" }`

**Image URL:** SmartIcon also accepts an HTTPS URL to a square image (under 100KB).

---

## Section Reference

JSON schemas for page sections below; the eight interactive section schemas are on [/spec/tools](https://appai.info/spec/tools). Also available via `GET /api/v1/sections` and `GET /api/v1/sections?format=jsonschema`.

### profile-header
```json
{"type":"profile-header","order":0,"data":{"name":"Jordan Example","eyebrow":"Maker","tagline":"Small useful tools","intro":"A fictional introduction.","avatar":{"url":"https://example.com/avatar.png","alt":""},"nav":[{"label":"Work","href":"#work"}],"links":[{"label":"Website","url":"https://example.com"}]}}
```
Required: `name`; avatar requires `url`, `alt`; links require `label`, `url`; nav requires `label`, `href` (`#anchor`). Links: HTTPS or `/path`; no mailto/tel, bare `#`, or unsafe schemes; invalid links omitted.

### project-cards
```json
{"type":"project-cards","order":1,"data":{"id":"work","heading":"Selected work","eyebrow":"Tools","items":[{"name":"Sample Notes","category":"Notes","description":"A fictional notebook.","icon":{"url":"https://example.com/icon.png","alt":""},"monogram":"SN","screenshot":{"url":"https://example.com/screen.png","alt":"Notes screen","kind":"web","width":1440,"height":900},"links":[{"label":"Details","url":"/p/jordan-example/jordan-sample-notes"}]}]}}
```
Required: each item's `name`; image objects require `url`, `alt`; screenshot requires `kind`: `phone|web`, optional positive `width`/`height` in px; monogram 1–2 characters; links follow profile-header rules. Icon, monogram, screenshot and links may all be omitted.

### entries
```json
{"type":"entries","order":2,"data":{"heading":"Focus","eyebrow":"Now","intro":"Optional Markdown.","items":[{"title":"Useful tools","description":"Fictional work in progress."}],"links":[{"label":"Website","url":"https://example.com"}]}}
```
Required: each item's `title`; all top-level fields optional; links require `label`, `url` and follow profile-header rules. No automatic heading text.

### hero
```json
{ "type": "hero", "order": 1, "data": {
    "headline": "Your App Name",
    "subheadline": "A short tagline",
    "logo": "https://example.com/logo.png",
    "backgroundColor": "#1E1B4B",
    "backgroundImage": "https://example.com/bg.jpg",
    "backgroundVideo": "https://example.com/bg.mp4",
    "variant": "centered",
    "heroHeight": "large",
    "ctaText": "Get Started",
    "ctaUrl": "https://example.com",
    "ctaSecondaryText": "Learn More",
    "ctaSecondaryUrl": "#features"
}}
```

### video
```json
{ "type": "video", "order": 2, "data": {
    "url": "https://youtube.com/watch?v=...",
    "caption": "Watch the demo"
}}
```
Supports YouTube, Vimeo, mp4, webm, gif (auto-detected).

### features
```json
{ "type": "features", "order": 3, "data": {
    "items": [
      { "icon": "rocket-outline", "title": "Fast", "description": "Blazing fast performance" }
    ]
}}
```

### screenshots
```json
{ "type": "screenshots", "order": 4, "data": {
    "heading": "Product views", "images": [{"url":"https://example.com/screen1.png","alt":"Product view","kind":"web","width":1440,"height":900}, "https://example.com/screen2.png"]
}}
```

`images` required; URL strings remain supported; objects use `url`, optional `alt`, `kind` (`phone|web`), positive `width`/`height` in px. `heading` optional; on editorial pages only, no heading or English alt is added by default; legacy pages default to “Screenshots” and numbered English alt.

### download
```json
{ "type": "download", "order": 5, "data": {
    "appStoreUrl": "https://apps.apple.com/app/...",
    "playStoreUrl": "https://play.google.com/store/apps/...",
    "ctaText": "Download Now"
}}
```

### pricing
```json
{ "type": "pricing", "order": 6, "data": {
    "items": [
      { "name": "Free", "price": "$0", "features": ["1 project", "Basic support"], "ctaText": "Start Free", "ctaUrl": "#" },
      { "name": "Pro", "price": "$9/mo", "features": ["Unlimited", "Priority support"], "highlighted": true, "ctaText": "Upgrade", "ctaUrl": "#" }
    ]
}}
```

### testimonials
```json
{ "type": "testimonials", "order": 7, "data": {
    "items": [
      { "name": "Jane Doe", "role": "CEO", "avatar": "https://example.com/avatar.jpg", "quote": "Amazing product!" }
    ]
}}
```

### faq
```json
{ "type": "faq", "order": 8, "data": {
    "items": [
      { "question": "Is it free?", "answer": "Yes, the basic plan is free." }
    ]
}}
```

### gallery
```json
{ "type": "gallery", "order": 9, "data": {
    "items": [
      { "url": "https://example.com/work1.jpg", "caption": "Project Alpha", "type": "image" }
    ]
}}
```

### team
```json
{ "type": "team", "order": 10, "data": {
    "items": [
      { "name": "Alice", "role": "CEO", "photo": "https://example.com/alice.jpg", "bio": "10 years in tech" }
    ]
}}
```

### schedule
```json
{ "type": "schedule", "order": 11, "data": {
    "items": [
      { "time": "10:00 AM", "title": "Opening Keynote", "speaker": "John", "description": "Welcome" }
    ]
}}
```

### sponsors
```json
{ "type": "sponsors", "order": 12, "data": {
    "items": [
      { "name": "Acme", "logo": "https://example.com/logo.png", "url": "https://acme.com" }
    ]
}}
```

### stats
```json
{ "type": "stats", "order": 13, "data": {
    "items": [
      { "value": "10K+", "label": "Users" },
      { "value": "99.9%", "label": "Uptime" }
    ]
}}
```

### contact
```json
{ "type": "contact", "order": 14, "data": {
    "email": "hello@example.com",
    "phone": "+1-555-0123",
    "address": "123 Main St"
}}
```

### cta
```json
{ "type": "cta", "order": 15, "data": {
    "headline": "Ready to start?",
    "subheadline": "Join thousands of users",
    "buttonText": "Sign Up Free",
    "buttonUrl": "https://example.com/signup"
}}
```

### links
```json
{ "type": "links", "order": 16, "data": {
    "items": [
      { "title": "Website", "url": "https://example.com", "icon": "globe-outline", "style": "filled" },
      { "title": "GitHub", "url": "https://github.com/...", "icon": "logo-github", "style": "outlined" }
    ]
}}
```

### about
```json
{ "type": "about", "order": 17, "data": {
    "heading": "Our Story",
    "text": "We started in 2024 with a simple idea..."
}}
```

### embed
```json
{ "type": "embed", "order": 23, "data": {
    "url": "https://www.tiktok.com/@user/video/1234567890",
    "title": "Optional heading above the embed",
    "caption": "Optional caption below",
    "aspectRatio": "9:16"
}}
```
Auto-detects provider from URL. Supported: YouTube, Vimeo, TikTok, Loom, Spotify, CodePen, Figma. X (Twitter) and Instagram render as linked preview cards (their iframe policy blocks direct embeds). `aspectRatio` optional — sensible default per provider (TikTok → 9:16, YouTube → 16:9). Iframe is sandboxed.

### Link rel (SEO)
Links in `links` and `cta` sections accept an optional `rel` string. Use `"nofollow"` for sponsored/affiliate/user-supplied links, `"sponsored"` for paid placements, `"nofollow sponsored"` for both. Leaving it unset produces `rel="noopener noreferrer"` for external links (standard dofollow). Example:
```json
{ "type": "links", "data": { "items": [
    { "title": "Our main site", "url": "https://acme.com" },
    { "title": "Sponsor", "url": "https://partner.com", "rel": "sponsored" },
    { "title": "User submission", "url": "https://ugc.com", "rel": "nofollow" }
]}}
```
