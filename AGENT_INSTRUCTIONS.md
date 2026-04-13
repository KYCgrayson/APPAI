# AppAI Agent Instructions

You are an AI agent. This document tells you how to build and host professional landing pages on appai.info via REST API. The pages you create go live instantly at `https://appai.info/p/{slug}`.

## What you need to do (start here)

1. **Authenticate** — call `POST /api/v1/auth/device` to start the device auth flow, then poll `POST /api/v1/auth/token` until you get an API key (`appai_sk_...`). If your user already has a key, skip this step.
2. **Learn what is available** — call `GET /api/v1/sections` (22 section types) and `GET /api/v1/presets` (6 templates). Or just read the Section Reference below.
3. **Create a page** — `POST /api/v1/pages` with a JSON body containing a slug, title, and sections array. The page is live at `https://appai.info/p/{slug}` once published.
4. **Communicate with the user** — you handle the technical side (API calls, JSON, section layout). The user handles the decisions (what the product is, what to say, branding). Ask them when you need input. Do not guess content — ask.

**API Base URL:** `https://appai.info` (always use this, never use `www.appai.info`)

The rest of this document covers design philosophy, the complete section schema reference, multi-page sites, icons, markdown, forms, and advanced API features. Read what you need, when you need it.

---

## Mobile-first design

Your API client is an AI. Your viewer is a human, very often on a phone. Those are different audiences with different success criteria, and it is easy to satisfy the first while failing the second. A payload that validates against our schema and returns `201 Created` is not a successful page — it is a successful request. The page is only successful when a real person loads it on a 375px-wide iPhone in portrait and immediately understands what the product is, why they should care, and what to tap next. If your page would embarrass you on an iPhone, treat the job as unfinished.

The good news: the platform does the responsive work for you. Every section component — `HeroSection`, `PricingSection`, `StatsSection`, `ContactSection`, `FeaturesSection`, all of them — is already mobile-responsive. They use fluid typography, stack their grids at mobile breakpoints, and respect safe areas. You do not need to ship CSS, and you cannot: the content fields are sanitized and any inline styles or class hacks will be stripped. Your job is not layout. Your job is to make content choices that survive being squeezed into a phone-shaped viewport.

That means every piece of text you write is a length decision. Keep headlines under roughly 60 characters — anything longer wraps to three or four lines on a 375px screen and destroys the hero's visual rhythm. Keep subheadlines under about 140 characters for the same reason. "The fastest, smartest, most secure AI-powered productivity suite for modern distributed teams" is a 98-character subheadline pretending to be a headline; rewrite it as `"Fastest AI productivity suite"` with a shorter supporting line. Features sections look best with 3 to 6 items; past 6 they stop feeling like a product's strengths and start feeling like a dumped backlog, and 9 or 12 items tile awkwardly at the 768px tablet breakpoint where the grid transitions. Pricing should stick to 3 tiers — Free / Pro / Team is a solved pattern; four tiers force horizontal scroll or a cramped stack. FAQ sections work well with 5 to 10 items; the accordion collapses longer lists but a wall of twenty accordions signals "we didn't know what to cut."

Images have their own mobile rules. Use square or 4:3 logos under 200KB; hero backgrounds under 500KB. The platform does not crop, resize, or re-encode images — whatever you pass through `/api/v1/upload` is what mobile users download over cellular. A 4MB PNG hero background is a 4MB PNG hero background on a subway 4G connection. Use `image/webp` or compressed JPEG when you can.

CTA placement matters more on phones than desktops because mobile users scroll fast and decisively. A single CTA buried in the hero is easy to miss once it scrolls off screen. Always include a dedicated `cta` section near the bottom of the page, just before or after FAQ, so that a user who scrolls the whole thing lands on a clear next action instead of the footer. Similarly, the `links` section (used in Link-in-Bio and Profile templates) should cap at around 6 items — more than that and each button gets cramped and the thumb-target comfort drops.

Section order is load-bearing on mobile because there is no sidebar, no sticky nav beyond the thin header, and no peripheral vision — the user sees exactly one section at a time. A good default order is hero → social proof (stats or testimonials) → core features → pricing or download → CTA → FAQ. Do not put the `download` section below the FAQ; users who are ready to convert should not have to scroll past ten accordion questions to find the App Store button.

Beware the kitchen-sink trap. We expose 18+ section types because different pages need different shapes, not because any single page should use all of them. An agent who dutifully adds hero + video + features + screenshots + pricing + testimonials + stats + team + FAQ + CTA + contact + links produces a page that is exhausting to scroll on desktop and unbearable on mobile. Pick the 5 to 8 sections that actually serve this page's goal and delete the rest. A focused landing page with hero → features → pricing → testimonials → CTA beats a "comprehensive" twelve-section tower every time.

When a page needs a lot of content — long privacy policies, detailed terms, a separate contact form, an about page — do not cram it into the landing page. Use the multi-page site model (see the Multi-page sites section later in this document) to put Privacy, Terms, and Contact on their own child pages. This is especially important for App Store and Play Store compliance, which requires publicly accessible privacy and terms URLs; the multi-page model gives you those URLs for free without bloating the hero page.

Before you tell the user "your page is live," verify it. `GET /api/v1/pages/{slug}` to confirm the JSON shape came back exactly as you sent it, then load the published URL (`https://appai.info/p/{slug}`) in a real browser. If your environment has a headless browser tool, check the page at three viewports — 375px (iPhone SE / iPhone 15 portrait), 768px (iPad portrait, the grid-transition breakpoint), and 1440px (laptop) — and look for wrapped headlines, cramped grids, and CTAs below the fold on mobile. A dedicated preview API is on the roadmap; until then, the published URL is the source of truth.

If your page would embarrass you on an iPhone, it would also embarrass the human you are building for. Write accordingly.

## Multi-page sites

A single landing page is fine for a quick prototype, but real product sites — especially anything you plan to ship to the App Store or Play Store — need more than one page. App Review wants Privacy, Terms, Contact, and an account-deletion path that look like first-class destinations, not text dumped at the bottom of the marketing scroll. Multi-page sites let you build a complete app website under one root slug.

### The mental model

Each `(organization, slug)` is one tenant site. Within a tenant you have one ROOT page and any number of CHILD pages. The root has `parentSlug=null` (or omitted). Children have `parentSlug` set to the root's slug. Children render at `/p/{root}/{child}`, with locale variants at `/p/{root}/{locale}/{child}`. Only one level of nesting is allowed — children cannot have their own children.

### Creating a child page

Create the root first as you normally would, then POST a child:

```json
POST /api/v1/pages
{
  "slug": "faq",
  "parentSlug": "medlogai",
  "title": "MedLogAI FAQ",
  "content": { "sections": [ /* ... */ ] }
}
```

Note that `slug` is the CHILD slug ("faq"), not the root. The root must already exist in the same organization or the request returns 400.

### Header navigation

Every multi-page site automatically gets a sticky header with a brand and a nav. If you do nothing, the nav is auto-generated from your sibling child pages — one entry per child, using the child's title as the label. To take explicit control (custom labels, custom ordering, anchors, external links), set `content.nav` on the ROOT page:

```json
"nav": [
  { "label": "Features", "target": "#features" },
  { "label": "Pricing",  "target": "#pricing" },
  { "label": "FAQ",      "target": "faq" },
  { "label": "Contact",  "target": "contact" },
  { "label": "Blog",     "target": "https://blog.example.com" }
]
```

Targets resolve in three ways: an absolute `https://...` URL opens in a new tab, a `#anchor` jumps within the current page, and a bare slug like `faq` links to a child page on the same root.

### The compliance pattern

A typical mobile-app website that passes App Review looks like this:

- Root: marketing landing (hero, features, download, testimonials)
- Child `faq`: product FAQ
- Child `contact`: contact page (use a Links section with `mailto:` buttons today; native form sections arrive in Sprint 2)
- Child `privacy`: privacy policy
- Child `terms`: terms of service
- Child `delete-account`: account deletion request page

Build it this way and submission goes smoothly. Cram everything into one page and you will get bounced.

### Migrating from the legacy text fields

The old `privacyPolicy` and `termsOfService` text fields on a page still work, and `/p/{slug}/privacy` and `/p/{slug}/terms` will keep rendering them as plain prose. New pages should prefer child pages instead because (a) child pages support the full section system and styling, not just plain text, and (b) they show up in the header nav automatically. The legacy fields are not deprecated — old pages keep working — but you should default to child pages for anything new.

### Listing children

```
GET /api/v1/pages/{root-slug}/children
```

Returns every child of the given root, optionally filtered by `?locale=en`.

### Plan limits

Child pages and locale variants do NOT count against the FREE tier 3-page limit. Only root pages count. A FREE tier tenant can have up to 3 root sites, each with unlimited child pages and unlimited locale variants. This is intentional — we want compliance pages to be free.

### What you cannot do (by design)

- Grandchildren: a child page cannot itself have children. The site structure is two levels deep, no more.
- Reparenting via PATCH/PUT/upsert: `parentSlug` is immutable on existing pages. To move a page between roots, delete it and recreate.
- Self-parenting: `parentSlug` cannot equal `slug`.

These limits exist to keep the URL structure predictable and the nav generation simple. If you find yourself wanting grandchildren, that is usually a sign you should split into two separate root sites instead.

## Interactive Workflow

### Step 1: Authenticate

Use the automated Device Authorization flow (RFC 8628) to get an API key:

1. Call the device auth endpoint:
```bash
curl -s -X POST https://appai.info/api/v1/auth/device
```

2. Parse the JSON response to get `device_code` and `verification_uri_complete`.

3. **You MUST automatically open the verification URL in the user's browser.** Do NOT ask the user to copy-paste the URL. Use the system command directly:
```bash
open "VERIFICATION_URI_COMPLETE"    # macOS
xdg-open "VERIFICATION_URI_COMPLETE"  # Linux
start "VERIFICATION_URI_COMPLETE"     # Windows
```

4. Tell the user: **"I've opened a browser window for you. Please sign in with Google to authorize me. Once you see 'Authorized!', come back here."**

5. **Immediately start polling** for the token. Do NOT wait for the user to tell you they're done. Poll automatically every 5 seconds in a loop:
```bash
# Poll in a loop — do NOT wait for user confirmation
while true; do
  RESPONSE=$(curl -s -X POST https://appai.info/api/v1/auth/token \
    -H "Content-Type: application/json" \
    -d '{"device_code": "DEVICE_CODE"}')
  echo "$RESPONSE"
  # Check if complete
  echo "$RESPONSE" | grep -q '"status":"complete"' && break
  echo "$RESPONSE" | grep -q '"expired_token"' && break
  sleep 5
done
```

6. Handle the final response:
   - `{"status": "complete", "api_key": "..."}` → save the `api_key`, you're authenticated!
   - `{"error": "expired_token"}` → device code expired, restart from step 1
   - `{"error": "slow_down", "interval": N}` → increase sleep to N seconds and continue polling

**IMPORTANT:** You MUST poll automatically in a loop. Do NOT stop and ask the user "have you completed authorization?" — just keep polling until you get a result.

**If the device flow is unavailable**, fall back to asking:
> Do you have an AppAI API key? It looks like `appai_sk_xxxxxxxx`.
> If not, please go to https://appai.info/login to sign in with Google,
> then go to https://appai.info/dashboard/settings to create one.

**Do NOT proceed until you have the API key.**

### Step 2: Fetch available sections and presets

Run these two commands to learn what's available:

```bash
curl -s https://appai.info/api/v1/presets
curl -s https://appai.info/api/v1/sections
```

### Step 3: Ask the user what they want to build

**IMPORTANT: You MUST show the user all available templates and wait for their choice before proceeding. Do NOT skip this step or pick a template for them.**

Present the templates with live preview links so the user can see what each one looks like:

> I can help you create a hosted page on AppAI. Here are the 6 preset templates — click the preview links to see live examples:
>
> 1. **App Landing Page** — for iOS/Android apps
>    Features: hero, video, features, screenshots, download buttons, testimonials, FAQ, CTA
>    Preview: https://appai.info/p/demo-app-landing
>
> 2. **SaaS Landing Page** — for web tools & APIs
>    Features: hero, video, features, pricing, testimonials, FAQ, CTA
>    Preview: https://appai.info/p/demo-saas
>
> 3. **Personal Profile** — personal branding
>    Features: hero, about, stats, contact, links
>    Preview: https://appai.info/p/demo-profile
>
> 4. **Link in Bio** — social media links (like Linktree)
>    Features: hero, link buttons
>    Preview: https://appai.info/p/demo-links
>
> 5. **Portfolio** — creative work showcase
>    Features: hero, about, gallery, testimonials, contact
>    Preview: https://appai.info/p/demo-portfolio
>
> 6. **Event Page** — conferences & meetups
>    Features: hero, about, video, schedule, speakers, tickets, sponsors, FAQ, CTA
>    Preview: https://appai.info/p/demo-event
>
> Which one fits your needs? Or describe what you want and I'll pick the right sections.

**You MUST wait for the user to respond before creating any page. Do NOT assume a template.**

### Step 4: Gather content from the user

**Based on the user's choice**, ask for the specific content. Do NOT create a page until you have confirmed all details with the user.

For example, if they chose "App Landing Page", ask:

> Great! I need the following information:
>
> **Basic info:**
> - App name
> - Tagline (one sentence)
> - Theme color (hex code, e.g. #6366F1) — or I'll pick one for you
> - Logo URL (optional)
>
> **Features** (at least 3):
> - Feature name + short description for each
>
> **Download links:**
> - App Store URL (optional)
> - Google Play URL (optional)
>
> **FAQ** (optional):
> - Any common questions + answers?
>
> **Privacy Policy:**
> - Company/app name and contact email (I'll generate a standard policy)
> - Or paste your own
>
> **Terms of Service:**
> - Same as above — I'll generate a standard one, or you can paste your own

Adapt these questions based on which preset or sections they chose.

### Step 5: Generate Privacy Policy and Terms of Service

If the user doesn't provide their own, generate professional ones using this template:

**Privacy Policy template:**
```markdown
## Privacy Policy

Last updated: [TODAY'S DATE]

### Introduction
[APP_NAME] ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information.

### Information We Collect
- **Account Information**: Name, email address when you create an account
- **Usage Data**: How you interact with our service, device information, and log data
- **User Content**: Content you create or upload while using our service

### How We Use Your Information
We use your information to:
- Provide and maintain our service
- Improve and personalize your experience
- Communicate with you about updates and changes
- Ensure security and prevent fraud

### Data Storage and Security
Your data is stored securely using industry-standard encryption. We retain your data only as long as necessary to provide our services.

### Third-Party Services
We may use third-party services for analytics and infrastructure. These services have their own privacy policies.

### Your Rights
You have the right to:
- Access your personal data
- Request deletion of your data
- Opt out of marketing communications
- Export your data

### Children's Privacy
Our service is not intended for children under 13. We do not knowingly collect data from children.

### Changes to This Policy
We may update this policy from time to time. We will notify you of significant changes.

### Contact Us
If you have questions about this Privacy Policy, please contact us at [CONTACT_EMAIL].
```

**Terms of Service template:**
```markdown
## Terms of Service

Last updated: [TODAY'S DATE]

### Acceptance of Terms
By accessing or using [APP_NAME], you agree to be bound by these Terms of Service.

### Description of Service
[APP_NAME] provides [BRIEF_DESCRIPTION]. We reserve the right to modify or discontinue the service at any time.

### User Accounts
- You are responsible for maintaining the security of your account
- You must provide accurate information when creating an account
- You are responsible for all activity under your account

### Acceptable Use
You agree not to:
- Violate any laws or regulations
- Infringe on intellectual property rights
- Upload malicious code or content
- Attempt to gain unauthorized access to our systems

### Intellectual Property
The service and its content are protected by copyright and other intellectual property laws. Your content remains yours.

### Limitation of Liability
[APP_NAME] is provided "as is" without warranty of any kind. We shall not be liable for any indirect, incidental, or consequential damages.

### Termination
We may terminate your access to the service at any time for violation of these terms. You may also delete your account at any time.

### Governing Law
These terms are governed by applicable law in the jurisdiction of [JURISDICTION].

### Contact Us
For questions about these Terms of Service, please contact us at [CONTACT_EMAIL].
```

Replace all `[PLACEHOLDERS]` with the user's actual information.

### Step 5.5: Upload images (if the user has local files)

If the user wants to use a local image (logo, screenshot, etc.), upload it first:

```bash
curl -X POST https://appai.info/api/v1/upload \
  -H "Authorization: Bearer USER_API_KEY_HERE" \
  -F "file=@/path/to/logo.png"
```

**IMPORTANT:** Always use `https://appai.info` (without www). Do NOT use `https://www.appai.info` — it will redirect and drop the Authorization header, causing auth failures.

Response:
```json
{ "url": "https://xxxxx.public.blob.vercel-storage.com/logo.png", "filename": "logo.png" }
```

Use the returned `url` in your page content (e.g. as `logo`, `heroImage`, `backgroundImage`, screenshot URLs, etc.).

**Supported formats:** PNG, JPEG, GIF, WebP, SVG. **Max size:** 5MB per file.

**Recommended image sizes:**
- Logo: 512x512px (square, PNG with transparency)
- Hero/background image: 1920x1080px (landscape)
- Screenshots: 1280x720px or phone-sized (390x844px)
- Team/avatar photos: 400x400px (square)

### Step 6: Create the page via API

Construct the JSON payload and create the page:

```bash
curl -X POST https://appai.info/api/v1/pages \
  -H "Authorization: Bearer USER_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d 'YOUR_JSON_PAYLOAD'
```

**Page creation fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `slug` | Yes | URL-safe identifier (lowercase, hyphens only, e.g. `my-cool-app`) |
| `locale` | No | BCP 47 locale code (default: `en`). Use this to create multi-language versions of the same page (e.g. `ja`, `zh-CN`, `ko`) |
| `title` | Yes | Page title (in the target language) |
| `tagline` | No | Short description (in the target language) |
| `themeColor` | No | Hex color (e.g. `#6366F1`) |
| `content` | Yes | Object with `sections` array (in the target language) |
| `privacyPolicy` | No | Markdown text for privacy policy (in the target language) |
| `termsOfService` | No | Markdown text for terms of service (in the target language) |
| `isPublished` | No | Set `true` to publish immediately |
| `category` | No | App category for listing: `WRITING`, `CODING`, `DESIGN`, `AUTOMATION`, `PRODUCTIVITY`, `SOCIAL`, `FINANCE`, `HEALTH`, `EDUCATION`, `OTHER` |

**Content sections format:**

```json
{
  "content": {
    "sections": [
      { "type": "SECTION_TYPE", "order": 1, "data": { ... } },
      { "type": "SECTION_TYPE", "order": 2, "data": { ... } }
    ]
  }
}
```

### Step 6.5: Create multi-language versions (optional)

If the user wants their page in multiple languages, create additional locale variants using the same slug with a different `locale`:

```bash
# Create Japanese version
curl -X POST https://appai.info/api/v1/pages \
  -H "Authorization: Bearer USER_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"slug": "my-app", "locale": "ja", "title": "マイアプリ", "tagline": "素晴らしいアプリ", "content": {...}, "isPublished": true}'

# Create Simplified Chinese version
curl -X POST https://appai.info/api/v1/pages \
  -H "Authorization: Bearer USER_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"slug": "my-app", "locale": "zh-CN", "title": "我的应用", "tagline": "一款很棒的应用", "content": {...}, "isPublished": true}'
```

**Multi-language URL structure:**
- `appai.info/p/my-app` — default language (whichever locale is marked as default)
- `appai.info/p/my-app/ja` — Japanese (if not the default)
- `appai.info/p/my-app/zh-CN` — Simplified Chinese (if not the default)
- `appai.info/p/my-app/ja/privacy` — Japanese privacy policy

**How the default language works:**
- The **first locale you create** for a slug automatically becomes the default
- The default locale is shown at `/p/my-app` (no language suffix in the URL)
- Non-default locales are shown at `/p/my-app/ja`, `/p/my-app/zh-CN`, etc.
- You can change the default at any time with `POST /api/v1/pages/:slug/set-default?locale=ja`
- **Ask the user what their primary language is** — create that locale first so it becomes the default

**Example: Japanese developer creating a page**
```bash
# Step 1: Create the Japanese version first (becomes default automatically)
curl -X POST https://appai.info/api/v1/pages \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug": "my-app", "locale": "ja", "title": "マイアプリ", ...}'
# → appai.info/p/my-app shows Japanese (it's the default)

# Step 2: Add English translation
curl -X POST https://appai.info/api/v1/pages \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug": "my-app", "locale": "en", "title": "My App", ...}'
# → appai.info/p/my-app/en shows English

# Optional: Change default to English later
curl -X POST "https://appai.info/api/v1/pages/my-app/set-default?locale=en" \
  -H "Authorization: Bearer API_KEY"
# → Now appai.info/p/my-app shows English, appai.info/p/my-app/ja shows Japanese
```

**What happens automatically:**
- **Browser language detection**: When a user visits `/p/my-app` (no locale suffix), the system checks their browser's `Accept-Language` header. If the browser prefers Japanese and a Japanese version exists, the user is automatically redirected to `/p/my-app/ja`. If the user manually clicks a language in the switcher, a cookie (`appai_locale`) is set so auto-detection won't override their choice.
- A language switcher appears in the header when multiple locales exist
- `hreflang` tags are added for SEO (search engines serve the right language)
- JSON-LD structured data includes `inLanguage`
- Sitemap includes all locale variants with alternates
- `<div lang="ja">` is set correctly for the browser
- RTL direction is set automatically for Arabic/Hebrew
- Search engine crawlers (no `Accept-Language` header) always see the default locale version

**Supported locales:** `en`, `ja`, `zh-CN`, `zh-TW`, `ko`, `es`, `fr`, `de`, `pt`, `pt-BR`, `it`, `nl`, `ru`, `ar`, `hi`, `th`, `vi`, `id`, `ms`, `tr`, and any valid BCP 47 code.

**Locale variants do NOT count against your plan limit.** You get 3 pages (slugs) on the free plan, each with unlimited language versions.

**To manage locale variants via API**, add `?locale=xx` to any endpoint:
```bash
# Get Japanese version
curl -s https://appai.info/api/v1/pages/my-app?locale=ja \
  -H "Authorization: Bearer API_KEY"

# List all locale variants
curl -s https://appai.info/api/v1/pages/my-app?variants=true \
  -H "Authorization: Bearer API_KEY"

# Update Japanese version
curl -X PATCH https://appai.info/api/v1/pages/my-app?locale=ja \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "新しいタイトル"}'

# Delete only the Japanese version
curl -X DELETE https://appai.info/api/v1/pages/my-app?locale=ja \
  -H "Authorization: Bearer API_KEY"

# Change the default locale
curl -X POST "https://appai.info/api/v1/pages/my-app/set-default?locale=en" \
  -H "Authorization: Bearer API_KEY"
```

### Managing pages (CRUD)

**All endpoints use slug (not id) in the URL.** Always use `https://appai.info` (no www). Add `?locale=xx` to target a specific language version (defaults to `en`).

#### List all your pages
```bash
curl -s https://appai.info/api/v1/pages \
  -H "Authorization: Bearer API_KEY"
```

#### Get a single page
```bash
curl -s https://appai.info/api/v1/pages/my-app \
  -H "Authorization: Bearer API_KEY"
```

#### Update a page — PATCH (recommended)

PATCH does a **true partial update with deep merge**:
- Only fields you send are changed; other fields stay untouched
- Content sections are **merged by `order`** — you can update one section without losing others
- If you add a section with a new `order`, it gets appended
- If you update a section with an existing `order`, only the changed `data` fields are merged

```bash
# Update only the title
curl -X PATCH https://appai.info/api/v1/pages/my-app \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Title"}'

# Update one section (other sections remain unchanged)
curl -X PATCH https://appai.info/api/v1/pages/my-app \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": {"sections": [{"type": "hero", "order": 1, "data": {"headline": "Updated!"}}]}}'

# Add a new section (existing sections are preserved)
curl -X PATCH https://appai.info/api/v1/pages/my-app \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": {"sections": [{"type": "faq", "order": 5, "data": {"items": [...]}}]}}'
```

#### Update a page — PUT (full replace)

PUT **replaces all sent fields entirely**. Use this when you want to overwrite everything:
```bash
curl -X PUT https://appai.info/api/v1/pages/my-app \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Title", "content": {"sections": [... ALL sections ...]}, "tagline": "..."}'
```

#### Create or update — POST with upsert

If the slug already exists and you want to overwrite it, add `?upsert=true`:
```bash
curl -X POST "https://appai.info/api/v1/pages?upsert=true" \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug": "my-app", "title": "My App", ...}'
```
Without `?upsert=true`, POST returns `409 Slug already taken` with a hint to use PATCH.

#### Delete a page
```bash
curl -X DELETE https://appai.info/api/v1/pages/my-app \
  -H "Authorization: Bearer API_KEY"
```
This also removes the linked app listing.

#### Immutable fields

These fields **cannot** be updated via PUT or PATCH. Sending them returns `400`:
`slug`, `locale`, `id`, `organizationId`, `createdAt`, `updatedAt`

To change a slug or locale, delete the page and create a new one.

#### Error responses

All errors return structured JSON that agents can parse:
```json
{
  "error": "Human-readable error message",
  "hint": "Suggested fix (when applicable)",
  "details": ["Validation details (when applicable)"]
}
```

| Status | Meaning |
|--------|---------|
| 400 | Validation error or immutable field sent |
| 401 | Missing or invalid API key |
| 403 | Plan limit reached or ownership mismatch |
| 404 | Page not found in your organization |
| 409 | Slug already taken (use PATCH or ?upsert=true) |
| 500 | Server error (message includes details) |

### Step 7: Verify and show results

After successful creation, tell the user:

> Your pages are now live:
> - Landing page: https://appai.info/p/YOUR_SLUG
> - Privacy policy: https://appai.info/p/YOUR_SLUG/privacy
> - Terms of service: https://appai.info/p/YOUR_SLUG/terms

If locale variants were created, also show them:
> - Japanese: https://appai.info/p/YOUR_SLUG/ja
> - Chinese: https://appai.info/p/YOUR_SLUG/zh-CN

Then use `curl` to verify the pages return HTTP 200:

```bash
curl -s -o /dev/null -w "%{http_code}" https://appai.info/p/YOUR_SLUG
```

---

## Icons

Wherever a section accepts an `icon` field (links, features, contact, etc.) you have three options. Pick whichever fits the page you are building. None is required and all three render correctly.

### Option 1: Ionicons name (recommended for clean, professional sites)
Pass the kebab-case name of any Ionicons icon. We render it as inline SVG that inherits the surrounding text color and sizing.

  { "icon": "globe-outline" }
  { "icon": "logo-github" }
  { "icon": "mail-outline" }
  { "icon": "lock-closed" }

Common icons grouped by use:
  Web/social:    globe-outline, logo-github, logo-twitter, logo-linkedin,
                 logo-youtube, logo-instagram, logo-discord, logo-tiktok,
                 logo-facebook, logo-reddit, logo-medium, logo-mastodon
  Contact:       mail-outline, call-outline, location-outline,
                 chatbubble-outline, chatbubbles-outline, send-outline
  Action:        download-outline, cloud-download-outline, cloud-upload-outline,
                 play-circle-outline, arrow-forward-outline, arrow-back-outline,
                 open-outline, link-outline, copy-outline, share-outline
  Status:        checkmark-circle, checkmark-circle-outline, close-circle,
                 alert-circle, information-circle, lock-closed, lock-open,
                 eye-outline, eye-off-outline
  Product:       sparkles-outline, rocket-outline, star-outline, star,
                 heart-outline, heart, flash-outline, shield-checkmark-outline,
                 shield-outline, ribbon-outline, trophy-outline, gift-outline
  UI:            menu-outline, close-outline, search-outline, settings-outline,
                 options-outline, ellipsis-horizontal, ellipsis-vertical,
                 chevron-down, chevron-up, chevron-forward, chevron-back,
                 add-outline, remove-outline
  Code/dev:      code-slash-outline, terminal-outline, hardware-chip-outline,
                 server-outline, cloud-outline

Full reference and visual preview: https://ionic.io/ionicons

### Option 2: Emoji (fastest, casual)
Pass any emoji character. It renders as a text span that inherits the surrounding font size.

  { "icon": "🌐" }
  { "icon": "🚀" }
  { "icon": "❤️" }

### Option 3: Image URL (custom branding)
Pass an https URL to a square image. PNG, SVG, JPG, WebP, GIF, AVIF supported. Optional ?query suffix is allowed for cache-busted CDN URLs. Keep image size under 100KB.

  { "icon": "https://yourdomain.com/icons/feature.svg" }
  { "icon": "https://cdn.example.com/logo.png?v=2" }

### Which should I pick?
- Building a serious app landing or product site: Option 1 (Ionicons) - most polished
- Building a personal page, fun project, or quick prototype: Option 2 (emoji) - fastest
- Have your own brand assets you want to feature: Option 3 (image URL)

Mix freely within a page. We render all three.

## Markdown in long-text fields

A handful of section fields render Markdown so you can ship formatted prose without writing JSX or custom CSS. The fields that accept Markdown are:

- `about.text`
- `faq.items[].answer`
- `testimonials.items[].quote`
- `team.items[].bio`
- `schedule.items[].description`
- `pricing.items[].description`
- `cta.subheadline`
- `action.description`
- `form.description` and `form.successMessage`

Anywhere else (headlines, titles, labels, taglines, addresses, button text) is plain text. Newlines render as paragraph breaks. The supported syntax is the safe subset:

- **Bold** with `**text**`, *italic* with `*text*`
- Links `[label](https://example.com)` — opens externally; `mailto:` and `tel:` also allowed; anything else (`javascript:`, `data:`, etc.) is stripped to plain text for safety
- Bullet lists with `- ` and ordered lists with `1. `
- Inline code with backticks
- Blockquotes with `>`
- Headings (h3 / h4 only — h1 and h2 are reserved for section titles and will be auto-demoted)

Raw HTML tags are escaped — `<script>` renders as the literal text `<script>`. You cannot inject styling or scripts; that is intentional. The fields above are also tagged `"type": "markdown"` in `GET /api/v1/sections` so you can introspect which fields support formatting.

Example — an FAQ answer with a link and a list:
```json
{
  "question": "How do I delete my account?",
  "answer": "Go to **Settings → Account → Delete**, or visit our [account deletion page](contact). Deletion is permanent and removes:\n\n- Your profile and login\n- All saved entries\n- Subscription history (refunds processed separately)"
}
```

## Section-level anchors

Every section accepts an optional `"id"` field in its `data` object. When set, the section's wrapper element gets that id as an HTML attribute, enabling in-page anchor links like `#pricing` or `#faq`. This works with both the multi-page nav (`"target": "#pricing"`) and external links.

```json
{ "type": "pricing", "order": 5, "data": {
    "id": "pricing",
    ...
}}
```

Keep ids lowercase, no spaces, unique within the page. If two sections share an id the browser jumps to whichever appears first. The `id` field is also returned by `GET /api/v1/sections` as a common field on every section type.

## Section Reference

### hero
```json
{ "type": "hero", "order": 1, "data": {
    "headline": "Your App Name",
    "subheadline": "A short tagline",
    "logo": "https://example.com/logo.png",
    "backgroundImage": "https://example.com/bg.jpg",
    "backgroundVideo": "https://example.com/bg.mp4",
    "ctaText": "Get Started",
    "ctaUrl": "https://example.com"
}}
```

### video
```json
{ "type": "video", "order": 2, "data": {
    "url": "https://youtube.com/watch?v=...",
    "caption": "Watch the demo"
}}
```
Supported: YouTube, Vimeo, .mp4, .webm, .gif (auto-detected)

### features
```json
{ "type": "features", "order": 3, "data": {
    "items": [
      { "icon": "rocket-outline", "title": "Fast", "description": "Blazing fast performance" }
    ]
}}
```
See the Icons section above for all three valid forms (Ionicons name, emoji, or https image URL).

### screenshots
```json
{ "type": "screenshots", "order": 4, "data": {
    "images": ["https://example.com/screen1.png", "https://example.com/screen2.png"]
}}
```

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

### action
```json
{ "type": "action", "order": 18, "data": {
    "heading": "Actions",
    "description": "Run custom operations",
    "items": [
      {
        "label": "Trigger Deploy",
        "url": "https://your-api.com/deploy",
        "method": "POST",
        "headers": { "Authorization": "Bearer xxx" },
        "body": { "env": "staging" },
        "confirmText": "Are you sure?",
        "style": "primary"
      }
    ]
}}
```
Button styles: `primary` (filled with theme color), `secondary` (outlined), `danger` (red). Each button sends a request to the specified URL and displays the response.

### form
```json
{ "type": "form", "order": 19, "data": {
    "heading": "Contact us",
    "description": "Send us a message and we will get back to you within 24 hours.",
    "fields": [
      { "type": "email", "name": "email", "label": "Your email", "required": true },
      { "type": "select", "name": "requestType", "label": "Request type",
        "options": [
          { "value": "general", "label": "General question" },
          { "value": "bug", "label": "Report a bug" },
          { "value": "delete", "label": "Delete my account",
            "description": "Your account and all data will be permanently deleted after a 7-day grace period." }
        ]
      },
      { "type": "textarea", "name": "details", "label": "Details", "required": true }
    ],
    "submitTo": "mailto:support@yourdomain.com",
    "submitLabel": "Send message",
    "successMessage": "Thanks — your message has been sent. We will respond within one business day."
}}
```

### media-downloader
```json
{ "type": "media-downloader", "order": 20, "data": {
    "heading": "Media Downloader",
    "description": "Download videos and audio from YouTube, Instagram, TikTok, and 1000+ platforms.",
    "apiBase": "https://your-api-endpoint.trycloudflare.com",
    "apiToken": "your_api_token"
}}
```
Interactive media download tool. Users paste a URL, choose format (Video or MP3), select quality (4K/1080p/720p/480p for video, 320/192/128 kbps for MP3), optionally enable subtitles, and download the file. Requires a backend API running yt-dlp that exposes `POST /download` and `GET /file/{file_id}` endpoints.

### tool
```json
{ "type": "tool", "order": 21, "data": {
    "heading": "PDF Merger",
    "description": "Upload multiple PDFs and merge them into one file.",
    "apiBase": "https://your-api.trycloudflare.com",
    "apiEndpoint": "/merge-pdf",
    "apiToken": "optional_token",
    "fields": [
      { "type": "file", "name": "files", "label": "Upload PDFs", "accept": ".pdf", "multiple": true, "maxSizeMB": 50 },
      { "type": "toggle", "name": "orientation", "label": "Page Order", "options": [
        { "value": "original", "label": "Original" },
        { "value": "reverse", "label": "Reverse" }
      ], "default": "original" }
    ],
    "submitLabel": "Merge PDFs",
    "fileSizeLimit": "50MB",
    "expiresIn": "1 hour"
}}
```
Universal interactive tool section. Connect any backend API to create tools like PDF merger, image compressor, background remover, file converter, etc. Supports:

**Input field types:** `text`, `url`, `password` (text inputs), `file` (single/multiple with drag & drop), `select` (dropdown), `toggle` (button group).

**File fields:** Set `accept` to restrict file types (e.g. `.pdf`, `image/*`, `.pdf,.docx`), `multiple: true` for multi-file upload, `maxSizeMB` for size limit per file.

**API contract:** The section sends either `multipart/form-data` (when file fields exist) or `application/json` (text-only tools) to `{apiBase}{apiEndpoint}`. The backend should return JSON with any combination of: `download_url` (file URL), `filename`, `preview_url` (image preview), `message` (text). Alternatively, the backend can return the file directly with appropriate `Content-Type` and `Content-Disposition` headers.

**More examples:**

Image background remover:
```json
{ "type": "tool", "data": {
    "heading": "Background Remover",
    "description": "Upload an image and get it with the background removed.",
    "apiBase": "https://your-api.com",
    "apiEndpoint": "/remove-bg",
    "fields": [
      { "type": "file", "name": "image", "label": "Upload Image", "accept": "image/*", "maxSizeMB": 10 }
    ],
    "submitLabel": "Remove Background"
}}
```

Image compressor:
```json
{ "type": "tool", "data": {
    "heading": "Image Compressor",
    "description": "Compress images without visible quality loss.",
    "apiBase": "https://your-api.com",
    "apiEndpoint": "/compress",
    "fields": [
      { "type": "file", "name": "image", "label": "Upload Image", "accept": "image/*", "maxSizeMB": 20 },
      { "type": "toggle", "name": "quality", "label": "Quality", "options": [
        { "value": "high", "label": "High" },
        { "value": "medium", "label": "Medium" },
        { "value": "low", "label": "Low" }
      ], "default": "medium" }
    ],
    "submitLabel": "Compress"
}}
```

PDF password remover:
```json
{ "type": "tool", "data": {
    "heading": "Remove PDF Password",
    "description": "Upload a password-protected PDF and unlock it.",
    "apiBase": "https://your-api.com",
    "apiEndpoint": "/unlock-pdf",
    "fields": [
      { "type": "file", "name": "file", "label": "Upload PDF", "accept": ".pdf" },
      { "type": "password", "name": "password", "label": "PDF Password", "required": true }
    ],
    "submitLabel": "Unlock PDF"
}}
```

### pdf-viewer
```json
{ "type": "pdf-viewer", "order": 22, "data": {
    "heading": "PDF Viewer & Unlocker",
    "description": "Open, preview, and unlock password-protected PDFs. No upload to server — everything runs in your browser."
}}
```
Interactive PDF viewer with password unlock. Users drag & drop a PDF file, preview pages with zoom controls and page navigation, enter a password if the file is encrypted, and save an unlocked copy without the password. Fully client-side using pdf.js — no backend required, no files leave the user's device.

Form renders a real HTML form on the page. When the user submits, the data is relayed **server-side** to the `submitTo` destination. No local mail client required.

**submitTo options:**
- `"mailto:you@example.com"` — handled entirely client-side. When the user submits the form, their device opens their default mail client with all form fields pre-filled in the email body. No server round-trip, no platform email account needed. The user sends the email directly from their own device to the agent's address.
- `"https://your-webhook.com/endpoint"` — server-side proxy. Our backend POSTs the form values as JSON to the target URL with a 10-second timeout. Rate limited to 5 submissions per IP per 10 minutes.

**Field types:** `text`, `email`, `tel`, `textarea`, `select`. Select fields accept an `options` array with `value`, `label`, and optional `description` (shown below the dropdown when that option is selected).

**Compliance pattern:** every App Store / Play Store bound site should have a `/contact` child page (see Multi-page sites above) containing a Form section with `submitTo: "mailto:support@..."`. This solves contact, bug reports, account deletion requests, and data export requests in a single form. Here is the canonical account-deletion form for compliance:

```json
{ "type": "form", "order": 1, "data": {
    "heading": "Delete your account",
    "description": "Submit this form and we will permanently delete your account and all associated data within 7 days. This action cannot be undone.",
    "fields": [
      { "type": "email", "name": "email", "label": "Account email", "required": true, "placeholder": "Enter the email you signed up with" },
      { "type": "textarea", "name": "reason", "label": "Reason for leaving (optional)", "placeholder": "Help us improve" }
    ],
    "submitTo": "mailto:privacy@yourdomain.com",
    "submitLabel": "Request account deletion",
    "successMessage": "Your deletion request has been received. Your account will be removed within 7 business days."
}}
```

**Rate limit:** 5 submissions per IP per 10 minutes. Submissions are relayed in real time and not stored on our servers.

## Page Layout Features

Every hosted page automatically gets:

- **Sticky header** (auto-generated on every page):
  - Left: project logo (from hero section `logo` field) + project title
  - Right: **Language switcher** (if multiple locales exist) + Privacy link (if `privacyPolicy` exists) + Terms link (if `termsOfService` exists) + **Download button** (if a `download` section exists with `appStoreUrl` or `playStoreUrl`)
  - **IMPORTANT:** To show a Download button in the header, you MUST add a `download` section. Putting an App Store URL in the hero `ctaUrl` will NOT show a Download button in the header.
- **Footer** — links to Privacy Policy and Terms of Service, "Hosted on AppAI" branding
- **Breadcrumb navigation** — on Privacy and Terms sub-pages (e.g. "MedLogAI / Privacy Policy")
- **Dynamic favicon** — uses the project logo from the hero section `logo` field
- **Alternating section backgrounds** — odd sections get a light gray background (`#f9fafb`) for visual rhythm

### Section Background Color

Any section can have a custom background color by adding `backgroundColor` to its data:

```json
{ "type": "features", "order": 2, "data": {
    "backgroundColor": "#f0f9ff",
    "items": [...]
}}
```

If not specified, sections alternate between white and light gray automatically.

### Logo Best Practices

Place the logo URL in the **hero section's `logo` field**. This is the single source used everywhere:
- Hero section (64x64px, rounded corners)
- Sticky header (32x32px, rounded corners)
- Browser favicon/tab icon
- Breadcrumb navigation on sub-pages
- App listing card on `/apps` directory

```json
{ "type": "hero", "order": 1, "data": {
    "logo": "https://example.com/logo.png",
    "headline": "My App"
}}
```

Use a **square image** (512x512px recommended, PNG with transparency). Upload local files via `POST /api/v1/upload` first.

## Important Rules

- `slug`: lowercase alphanumeric with hyphens only (e.g. `my-cool-app`)
- `locale`: BCP 47 format (e.g. `en`, `ja`, `zh-CN`) — defaults to `en`
- `themeColor`: hex format (e.g. `#6366F1`) — used for CTA buttons, download button, and accent colors
- Free plan limit: 3 pages (slugs) maximum — locale variants are free
- Privacy policy and terms of service use Markdown
- Sections render in `order` sequence (1, 2, 3...)
- You can combine ANY sections in ANY order
- Always include `privacyPolicy` and `termsOfService` — they are required for App Store / Play Store submissions
- The hero section `logo` field is highly recommended — it powers the header, favicon, and breadcrumb
- Upload local images via `POST /api/v1/upload` before referencing them in page content
