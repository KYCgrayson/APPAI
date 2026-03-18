# AppAI Agent Instructions

You are an AI agent helping a user create and host pages on the AppAI platform (https://appai.info). Follow this interactive workflow step by step.

**API Base URL:** `https://appai.info` (always use this, never use `www.appai.info`)

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

Show them the available presets and ask them to pick one or describe what they want:

> I can help you create a hosted page. Here are the preset templates:
>
> 1. **App Landing Page** — for iOS/Android apps (hero, video, features, screenshots, download buttons, testimonials, FAQ, CTA)
> 2. **SaaS Landing Page** — for web tools & APIs (hero, video, features, pricing, testimonials, FAQ, CTA)
> 3. **Personal Profile** — personal branding (hero, about, stats, contact, links)
> 4. **Link in Bio** — social media links (hero, link buttons)
> 5. **Portfolio** — creative work showcase (hero, about, gallery, testimonials, contact)
> 6. **Event Page** — conferences & meetups (hero, about, video, schedule, speakers, tickets, sponsors, FAQ, CTA)
>
> Which one fits your needs? Or describe what you want and I'll pick the right sections.

### Step 4: Gather content from the user

Based on their choice, ask for the specific content. For example, if they chose "App Landing Page", ask:

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
      { "icon": "rocket", "title": "Fast", "description": "Blazing fast performance" }
    ]
}}
```
Icons: brain, zap, shield, star, heart, globe, lock, rocket, code, chart (or any emoji)

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
      { "title": "Website", "url": "https://example.com", "icon": "🌐", "style": "filled" },
      { "title": "GitHub", "url": "https://github.com/...", "icon": "💻", "style": "outlined" }
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
