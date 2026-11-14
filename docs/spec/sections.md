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

#### Feed layout (optional)

Use `layout: "feed"` for a podcast episode archive, video digest, changelog or blog index. Default/`"grid"` retains the existing two-column project grid; no new fields are required. Background defaults stay the same as `profile-header` (including dark mode).

| Field | Contract |
|---|---|
| `data.layout` | `"grid"` (default) or `"feed"`; any other value is a validation error. |
| `items[].href` | Optional title **and description** link in both layouts; ≤2048 characters. See the destination table below. |
| `items[].meta` | Optional array of 0–3 strings; each 1–40 characters **after trim**. Joined by ` · ` above the title in both layouts. An empty array hides metadata. |
| `items[].media` | Optional array of **1–2** `{url, alt, href?, label?, aspect?}` tiles. Validated in both layouts; **only rendered in feed**, ignored in grid. An empty array is invalid; omit instead. |
| `media[].url` / `alt` | HTTPS image URL without credentials (like screenshot URLs; no extension requirement). `alt` is required, but `""` is allowed for decorative images. A linked decorative tile uses its label or item name as the accessible link name. |
| `media[].href` | Optional independent tile link; same rules as item `href`. Without it the tile is a plain figure. |
| `media[].label` | Optional publisher-written corner badge, ≤24 characters, e.g. `"6 key moments"` or `"▶ 5:12"`. |
| `media[].aspect` | `"16:9"` (default), `"1:1"` or `"4:5"`. The box reserves space before the image loads; images fill/crop to fit. |
| `items[].featured` | Optional boolean, **feed only**. Only the first `true` item is enlarged: larger title, each tile full width and stacked. Later `true` values and all grid values are ignored. |
| `items[].description` | Still plain text; feed preserves internal line breaks with `white-space: pre-line` and never clamps text. |

| `href` destination | Accepted? |
|---|---|
| `https://example.com/episode` | Yes, absolute HTTPS without credentials. External origins open a new tab. |
| `/p/paper-observatory`, `/p/paper-observatory/episode?t=90#video` | Yes, hosted paths (letters/digits/hyphens per segment), optional `?t=time` and/or `#anchor`. |
| `#moments`, `?t=1:30#video` | Yes, same-page anchors and time links; time links retain the delegated video seek behavior. |
| `javascript:`, `data:`, `http:`, `//example.com`, credentials, other relative paths | No; rejected before writing, including in preview. |

Anchors start with an ASCII letter and contain letters, digits, `_` or `-`. Time uses the video contract: integer seconds 0–86400, `m:ss` (0–59 minutes) or `h:mm:ss` up to `24:00:00`. Bare `?t=90` is not a card destination: include `#video`. Hosted paths accept only the optional `t` query; absolute HTTPS URLs may have other query parameters.

| Existing field | Feed mapping |
|---|---|
| `name` | Post title (still required); linked when `href` is supplied. |
| `icon` / `monogram` | Small beside the metadata row; icon takes precedence. |
| `category` | First/only metadata entry **only when `meta` is absent**. |
| `screenshot` | One `16:9` media tile **only when `media` is absent**; `alt` retained. Phone/web framing and screenshot dimensions apply only to grid. |
| `links` | Existing destinations/rules, displayed after media as small text links separated by ` · `. |

Feed is centered at max-width 680px with hairline dividers. Normal two-tile rows stay side by side at mobile/tablet/desktop widths; one tile fills the row. First-card images load eagerly; later cards' images are lazy. Title, description and tile links are separate anchors, so cards never nest interactive links. Existing ItemList JSON-LD and `llms.txt` use `href` when present; feed media can supply the OG/list image.

Fictional preview body — POST to `/api/v1/pages/preview` (same shape as page creation; this does not publish):
```json
{
  "slug": "paper-observatory",
  "title": "The Paper Observatory",
  "template": "PERSON",
  "locale": "en",
  "themeColor": "#b0461f",
  "content": {
    "sections": [{
      "type": "project-cards", "order": 0,
      "data": {
        "layout": "feed", "heading": "Episode feed",
        "items": [{
          "name": "How small ideas grow",
          "href": "/p/paper-observatory/episode-12?t=90#video",
          "meta": ["Episode 12", "8 min"],
          "description": "A fictional conversation about curiosity.\nThree questions to take into the week.",
          "media": [
            {"url": "https://example.com/episode-12.png", "alt": "Paper landscape episode artwork", "href": "/p/paper-observatory/episode-12#moments", "label": "6 key moments"},
            {"url": "https://example.com/episode-12-sketch.png", "alt": "Sketch of three discussion topics", "href": "/p/paper-observatory/episode-12?t=90#video", "label": "▶ 5:12", "aspect": "1:1"}
          ],
          "links": [{"label": "Episode notes", "url": "/p/paper-observatory/episode-12"}]
        }]
      }
    }]
  }
}
```
The example URLs and episode are fictional. Replace image URLs with real HTTPS images and publish the linked episode separately; a same-page seek link needs a video section with the matching id. Image availability and MIME type are not fetched/verified by preview. The existing plain-text sanitizer still removes HTML tags.

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

YouTube (including Shorts), Vimeo and direct mp4/webm → `video`; social posts from Instagram, Facebook, Threads, TikTok and X → `embed`.

### video

Hosted Page capability: attach generic timestamped key moments to any video; no publisher-specific data format.

```json
{ "type": "video", "order": 2, "data": {
    "id": "intro-video",
    "url": "https://media.example.com/fictional-orbit-demo.mp4",
    "caption": "Orbit Studio — a fictional drawing tutorial",
    "startAt": "0:15",
    "momentsHeading": "Inside the demo",
    "moments": [
      { "t": 0, "title": "Set up the canvas" },
      { "t": "1:30", "title": "Draw an orbit", "text": "Use **layers** to keep each shape editable." },
      { "t": "3:00", "title": "Export the artwork" }
    ],
    "uploadDate": "2026-01-15T09:00:00Z",
    "duration": "PT4M",
    "thumbnail": "https://media.example.com/fictional-orbit-cover.jpg"
}}
```

| Field | Contract |
|---|---|
| `url` | Required. YouTube: exact `youtube.com` / `www.youtube.com` / `m.youtube.com` watch, live, shorts or embed paths; `youtu.be/<id>`; `youtube-nocookie.com` / `www.youtube-nocookie.com` embed paths. ID: 11 letters/digits/`_`/`-`. Vimeo: `vimeo.com/<digits>`, optional `/<hash>` or `?h=<hash>`, or `player.vimeo.com/video/<digits>?h=<hash>`. Provider HTTP links normalize to HTTPS embeds. Direct files: HTTPS `.mp4`, `.webm`, `.gif` (case-insensitive path; query preserved). Unsupported URLs are errors for new content, with a field path and supported-URL hint. An unrecognized HTTP(S) URL (e.g. Vimeo showcase, HTTP `.mp4`, `.m3u8`) is grandfathered with a warning only when that exact URL is already stored in the same section of the existing page (matching section ID, authored `data.id`, or order and type). Create never grandfathers. Non-HTTP(S) schemes, XSS, credentials, non-default ports and lookalike provider hosts remain hard errors even if stored. |
| `moments` | Optional array, max 100 input entries, each `{t, title, text?}`. Time: integer seconds, decimal integer string, `m:ss` or `h:mm:ss`, 0–86400 inclusive; minute/second parts below 60. Normalized to integer seconds, ascending order; same timestamp keeps the first input entry and warns with each dropped moment path. On unrecognized URLs, warns “moments need a YouTube, Vimeo or https .mp4/.webm URL” and renders the list as plain text without links. |
| `moments[].title` | Required nonblank plain text, max 120 characters. |
| `moments[].text` | Optional safe Markdown, max 600 characters; same renderer as `about.text`, no raw HTML or executable link schemes. |
| `momentsHeading` | Optional, max 60 characters. Defaults: en “Key moments”, zh-TW “重點時刻”, zh-CN “重点时刻”, ja “主なシーン”, ko “주요 장면”, es “Momentos clave”, fr “Moments clés”, de “Wichtige Momente”. Hosted locale exact → primary language → English via `pickByLocale`. |
| `startAt` | Optional initial position, same time parser. Does not autoplay. |
| `uploadDate` | Optional SEO: real first-publication `YYYY-MM-DD`, `YYYY/MM/DD` or ISO datetime with timezone; calendar-checked and normalized to ISO 8601. Invalid values warn and are omitted. Never synthesized from the current date. |
| `duration` | Optional SEO: positive ISO 8601 day/time duration, max 24h, e.g. `PT4M`. Invalid values warn and are omitted; valid values require all moments and `startAt` to precede them. Supplies the last clip's end offset. |
| `thumbnail` | Optional HTTPS image URL (no credentials or non-default port). Invalid optional metadata warns and is omitted; unsafe schemes remain errors. Supplies SEO `thumbnailUrl` and the facade; YouTube otherwise uses its real `i.ytimg.com` thumbnail. No invented Vimeo thumbnail. |

All new fields are optional. GIFs remain images and cannot use `moments` or `startAt`. `heading`, `subheading` and `caption` retain their existing behavior. Create/upsert, full PUT, merged page/section PATCH and preview use the same validator and return warnings as `{path, message}` objects. New or changed unsupported video URLs are hard errors; unchanged grandfathered URLs and invalid optional SEO metadata warn. PATCH validates only changed sections after merging their data and preserves untouched sections, so title-only and unrelated-section edits on legacy pages succeed. Invalid times, limits and unsafe URLs remain hard errors; errors include locations such as `sections[2].data.moments[3].t`. Preview with `POST /api/v1/pages/preview` or `POST /api/v1/pages?dryRun=true`; inspect `/api/v1/sections?type=video&format=jsonschema` for field limits and time alternatives. Calendar validity, provider URL semantics and duration-relative times are also checked server-side.

Stored legacy provider/file rows keep their media rendering without a facade or seeking (including Vimeo showcases, HTTP `.mp4` and `.m3u8`). A legacy iframe fallback requires a parsed YouTube/Vimeo hostname: exact `youtu.be`, or `youtube.com`, `vimeo.com`, `youtube-nocookie.com` and their subdomains. Other stored web URLs render an external “Open video” link card with the hostname; a provider name in the path, query or fragment never permits an iframe. Unsafe schemes and lookalike provider hosts show “Video unavailable”.

| Visitor behavior | Result |
|---|---|
| Before interaction | Thumbnail/play facade; no provider iframe or SDK script. Vimeo without a thumbnail gets a neutral play facade. Thumbnail loading can contact the image host. |
| Click play or a moment | Load the platform-built privacy-enhanced YouTube/Vimeo iframe and seek in-page using postMessage; direct files use native video controls. Only the latest requested time is applied. |
| JavaScript disabled | Moment/play links open the provider or direct file at that timestamp. |
| Playback blocked | Localized “Jumped to m:ss — press play” status plus external time link. |
| Timeout (~8 seconds), refused embed or media error | Visible external time link; moment anchors also retain their external fallback. |
| `?t=90#intro-video` | Targets `data.id || section.id`; missing/unknown anchor targets the first seekable video in document order. A section with moments and no authored ID gets `video-<rendered index>`; prefer an explicit stable `id`. |
| Initial shared URL | Prepares the facade's selected position; provider loads after play/moment interaction. Back/forward restores the selected time and seeks an already loaded player without autoplay. Without JS, an existing `#id` still scrolls. |
| Markdown anywhere on the page | `[▶ 1:30](?t=90#intro-video)` seeks the same page's video. Foreign origins/paths, unrelated query changes, download/new-tab links and modified clicks retain normal navigation. |

The first visible video facade thumbnail loads eagerly with high fetch priority; later thumbnails remain lazy. The player reserves 16:9 space and declares image dimensions. YouTube uses `hqdefault.jpg` unless an explicit thumbnail is supplied.

SEO: server-rendered `VideoObject` uses the first nonblank name from caption → section `heading` → explicitly supplied `momentsHeading` → page title; without any it is omitted. The localized default “Key moments” is never used as a video name. Description is included only for a real caption. It uses direct files as `contentUrl`, providers as `embedUrl`, and `hasPart: Clip[]` ordered by time (`name`, `startOffset`, `url` to this hosted page's `?t=...#id`). Each clip ends at the next moment; the last has `endOffset` only with supplied duration. Unknown `uploadDate`/`duration`/`thumbnailUrl` are omitted, except the real YouTube thumbnail fallback. Google requires real upload date and thumbnail for video rich-result eligibility; missing metadata is intentionally not fabricated. See [Google video structured data](https://developers.google.com/search/docs/appearance/structured-data/video).

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
