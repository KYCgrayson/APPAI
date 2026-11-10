# AppAI — Sections
Covers section schemas and icons; interactive tool schemas remain on /spec/tools and game schemas on /spec/games.
Previous: [Pages](https://appai.info/spec/pages) · Next: [Multi-language & multi-page](https://appai.info/spec/i18n)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

Optional heading/subheading: pricing, faq, features, screenshots, download (heading overrides ctaText), video, testimonials, gallery, team, schedule, sponsors, stats, contact, links, about, action, form, media-downloader, tool, pdf-viewer, embed, iframe-tool, video-subtitle, simple-order, project-cards, entries. Hero/cta use headline/subheadline; profile-header uses name/tagline; entries also supports intro. Omitted fields preserve existing rendering.

Give both store URLs; the page picks the right one per device. Hero primary button = the store the user listed first. Set hero ctaUrl/ctaSecondaryUrl to the store URLs in that order; recognized apps.apple.com and play.google.com URLs render badges in every hero variant. Both badges render server-side; iOS emphasizes App Store first, Android Google Play first; desktop keeps both. Badge dimensions stay fixed during client reordering.

After [dry-run](https://appai.info/spec/api#preview-without-saving), follow the [publish steps](https://appai.info/spec#publish-in-one-minute).

## Icons

Three formats, all render correctly. Mix freely within a page.

**Ionicons (recommended):** Use built-in icon names or any emoji; discover names via `GET /api/v1/sections`. Bundled names:
logo-line, logo-threads, logo-whatsapp, people-outline, time-outline, calendar-outline, camera-outline, color-palette-outline, hand-left-outline, leaf-outline, cafe-outline, cut-outline, bicycle-outline, brush-outline, school-outline, globe-outline, logo-github, logo-twitter, logo-linkedin, logo-youtube, logo-instagram, logo-discord, logo-tiktok, logo-facebook, logo-reddit, logo-medium, logo-mastodon, mail-outline, call-outline, location-outline, chatbubble-outline, chatbubbles-outline, send-outline, download-outline, cloud-download-outline, cloud-upload-outline, play-circle-outline, arrow-forward-outline, arrow-back-outline, open-outline, link-outline, copy-outline, share-outline, checkmark-circle, checkmark-circle-outline, close-circle, alert-circle, information-circle, lock-closed, lock-open, eye-outline, eye-off-outline, sparkles-outline, rocket-outline, star-outline, star, heart-outline, heart, flash-outline, shield-checkmark-outline, shield-outline, ribbon-outline, trophy-outline, gift-outline, menu-outline, close-outline, search-outline, settings-outline, options-outline, ellipsis-horizontal, ellipsis-vertical, chevron-down, chevron-up, chevron-forward, chevron-back, add-outline, remove-outline, code-slash-outline, terminal-outline, hardware-chip-outline, server-outline, cloud-outline

**Emoji:** Pass any emoji character. `{ "icon": "🚀" }`

**Image URL:** SmartIcon also accepts an HTTPS URL to a square image (under 100KB).

---

## Section Reference

Browser games use the [`game` section](https://appai.info/spec/games#game), available on every template; `GAME` supplies a page H1. Games have a narrower iframe permission set and currently receive no AppAI session, including with `identity: true`; see the game contract.

JSON schemas for page sections below; the eight interactive section schemas are on [/spec/tools](https://appai.info/spec/tools). Also available via `GET /api/v1/sections` and `GET /api/v1/sections?format=jsonschema`.

### profile-header
```json
{"type":"profile-header","order":0,"data":{"name":"Jordan Example","eyebrow":"Maker","tagline":"Small useful tools","intro":"A fictional introduction.","avatar":{"url":"https://example.com/avatar.png","alt":""},"nav":[{"label":"Work","href":"#work"}],"links":[{"label":"Website","url":"https://example.com"}]}}
```
Required: `name`; avatar requires `url`, `alt`; links require `label`, `url`; nav requires `label`, `href` (`#anchor`). Links: HTTPS or `/path`; no mailto/tel, bare `#`, or unsafe schemes; invalid links omitted.

### project-cards

Use for a card wall or summary wall: a responsive grid of items, each with a name and optional short description, image/icon and links.
```json
{"type":"project-cards","order":1,"data":{"id":"work","heading":"Selected work","eyebrow":"Tools","items":[{"name":"Sample Notes","category":"Notes","description":"A fictional notebook.","icon":{"url":"https://example.com/icon.png","alt":""},"monogram":"SN","screenshot":{"url":"https://example.com/screen.png","alt":"Notes screen","kind":"web","width":1440,"height":900},"links":[{"label":"Details","url":"/p/jordan-example/jordan-example-sample-notes"}]}]}}
```
Required: each item's `name`; image objects require `url`, `alt`; screenshot requires `kind`: `phone|web`, optional positive `width`/`height` in px; monogram 1–2 characters; links follow profile-header rules. Icon, monogram, screenshot and links may all be omitted.

### entries
```json
{"type":"entries","order":2,"data":{"heading":"Focus","eyebrow":"Now","intro":"Optional Markdown.","items":[{"title":"Useful tools","description":"Fictional work in progress."}],"links":[{"label":"Website","url":"https://example.com"}]}}
```
Required: each item's `title`; all top-level fields optional; links require `label`, `url` and follow profile-header rules. No automatic heading text.

### hero

`ctaUrl` (and `ctaSecondaryUrl`) allows `tel:+{E.164 digits}` and renders it as a tappable phone link.
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

YouTube/Vimeo/mp4 → `video` (iframe player); social posts from Instagram, Facebook, Threads, TikTok, X, YouTube Shorts → `embed`.

### video
```json
{ "type": "video", "order": 2, "data": {
    "url": "https://youtube.com/watch?v=...",
    "caption": "Watch the demo"
}}
```
Supports YouTube/Vimeo iframe players and direct mp4, webm, gif media (auto-detected). Use `embed` for YouTube Shorts and social posts.

### features

For menus and service price lists, put the price in `price` on each `features.items` entry (string, e.g. "NT$140"); it renders next to the title.

`heading` and `subheading` are optional. For a few priced services without feature lists, use `features` with the price in each description; use `pricing` only for plans/tiers with feature lists (each plan requires `features[]`).
```json
{ "type": "features", "order": 3, "data": {
    "heading": "Optional section title",
    "subheading": "Optional supporting text",
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

Use `schedule` for event timelines (`time` + session `title`); use `contact.hours` for weekly opening hours.
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

`heading` and `subheading` are optional.
```json
{ "type": "contact", "order": 14, "data": {
    "heading": "Optional section title",
    "subheading": "Optional supporting text",
    "email": "hello@example.com",
    "phone": "+1-555-0123",
    "address": "123 Main St"
}}
```

Optional `hours`: array of `{days: ["mon", "tue"], open: "09:00", close: "17:00", note?: "…"}`; days must be nonempty mon–sun values, times 24-hour HH:MM. Omit closed days; use multiple entries for split shifts, and a close earlier than open for overnight hours. Day names follow the page locale. Optional contact `note` adds a general hours note (e.g. "Closed on public holidays"). Address and/or hours emits LocalBusiness JSON-LD with title, logo, phone and social URLs.

Optional `map: true` with `address` shows "Open in Google Maps" / "Open in Apple Maps" links using encoded address queries; no iframe, geocoding, key or secret needed.

Optional `socials`: `{platform, url, label?}` items; HTTPS only. See canonical [Contact](https://appai.info/spec/pages#contact) for platforms, URL formats and message booking.

### cta

`buttonUrl` allows `tel:+{E.164 digits}` and renders it as a tappable phone link.

Use `cta` only on landing-type pages: app, product, SaaS, company/service, event and hiring. Do not add it to PERSON/profile, link-in-bio, portfolio, card-wall or wrapped-tool pages.
```json
{ "type": "cta", "order": 15, "data": {
    "headline": "Ready to start?",
    "subheadline": "Join thousands of users",
    "buttonText": "Sign Up Free",
    "buttonUrl": "https://example.com/signup"
}}
```

### links
Optional `heading` and `subheading` appear above the link buttons.


`items[].url` allows `tel:+{E.164 digits}` and renders it as a tappable phone link.
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
Auto-detects provider from URL. Supported: YouTube (including Shorts), Vimeo, Facebook posts/videos, Threads posts, TikTok, Loom, Spotify, CodePen, Figma. Facebook uses official plugin iframes; Threads uses a lazy-loaded sandboxed iframe at `https://www.threads.com/@{user}/post/{id}/embed`. Instagram posts/reels use official sandboxed iframes at `https://www.instagram.com/p/{id}/embed` or `/reel/{id}/embed` (public, embeddable posts only). X (Twitter) renders as a linked preview card. HTTP URLs are upgraded to HTTPS. Existing provider URL patterns remain supported, including mobile/music YouTube watch URLs and YouTube privacy embed URLs. `aspectRatio` optional — sensible default per provider (TikTok → 9:16, YouTube → 16:9). Iframe is sandboxed.

### Link rel (SEO)
Links in `links` and `cta` sections accept an optional `rel` string. Use `"nofollow"` for sponsored/affiliate/user-supplied links, `"sponsored"` for paid placements, `"nofollow sponsored"` for both. Leaving it unset produces `rel="noopener noreferrer"` for external links (standard dofollow). Example:
```json
{ "type": "links", "data": { "items": [
    { "title": "Our main site", "url": "https://acme.com" },
    { "title": "Sponsor", "url": "https://partner.com", "rel": "sponsored" },
    { "title": "User submission", "url": "https://ugc.com", "rel": "nofollow" }
]}}
```

### Wrapped tool publishing checks
The tool stays on the user's host; AppAI does not build or deploy it. Before publishing run `curl -sI https://your-tool.vercel.app` (check the final response after redirects). Fix blocking headers on the user's host: remove X-Frame-Options DENY/SAMEORIGIN and set `Content-Security-Policy: frame-ancestors 'self' https://appai.info`. Preserve other CSP directives.

Minimal vercel.json:
```json
{"headers":[{"source":"/(.*)","headers":[{"key":"Content-Security-Policy","value":"frame-ancestors 'self' https://appai.info"}]}]}
```
Netlify `_headers`: under `/*`, add `  Content-Security-Policy: frame-ancestors 'self' https://appai.info`.
Cloudflare Pages `_headers`: under `/*`, add `  Content-Security-Policy: frame-ancestors 'self' https://appai.info`.

Sandbox: `allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox`. The existing scripts/same-origin model is restricted to allowlisted external hosts; no top navigation token. Permissions `allow`: `fullscreen; clipboard-write; gamepad; accelerometer; gyroscope`; `allowFullscreen:false` removes only fullscreen. Downloads generated in-browser and clipboard writes are permitted (browser permission/user activation rules still apply).

The iframe receives `?locale=` with the current hosted-page locale, normally `en`, `zh-TW`, `zh-CN`, `es` (any supplied BCP 47 locale is passed unchanged), plus `color` and `theme=dark` only in dark mode. If the tool isn't translated, ignore it; the AppAI page around it is still published in four locales.
Set canonicalUrl only for an app's own primary marketing site (e.g. a custom domain homepage), never the *.vercel.app tool URL embedded in iframe-tool.

Older pages opt in when their content is saved again through the API (PUT, PATCH, PATCH section, or POST ?upsert=true).

All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps) · [Games](https://appai.info/spec/games)
