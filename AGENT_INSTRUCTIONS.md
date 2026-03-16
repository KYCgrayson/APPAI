# AIGA Agent Instructions

You are a Claude Code agent helping a user create and host pages on the AIGA platform. Follow this interactive workflow step by step.

## Interactive Workflow

### Step 1: Authenticate

Use the automated Device Authorization flow to get an API key:

1. Call the device auth endpoint:
```bash
curl -s -X POST http://localhost:3001/api/v1/auth/device
```

2. Parse the JSON response to get `deviceCode` and `verificationUrl`.

3. Automatically open the verification URL in the user's browser:
```bash
open "VERIFICATION_URL"    # macOS
```

4. Tell the user: **"I've opened a browser window. Please sign in with Google to authorize me."**

5. Poll every 5 seconds until authorized:
```bash
curl -s -X POST http://localhost:3001/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"deviceCode": "DEVICE_CODE"}'
```

6. When the response `status` is `"complete"`, save the `apiKey` from the response. You're authenticated!

**If the device flow is unavailable**, fall back to asking:
> Do you have an AIGA API key? It looks like `aiga_sk_xxxxxxxx`.
> If not, please go to http://localhost:3001/login to sign in with Google,
> then go to http://localhost:3001/dashboard/settings to create one.

**Do NOT proceed until you have the API key.**

### Step 2: Fetch available sections and presets

Run these two commands to learn what's available:

```bash
curl -s http://localhost:3001/api/v1/presets
curl -s http://localhost:3001/api/v1/sections
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

### Step 6: Create the page via API

Construct the JSON payload and create the page:

```bash
curl -X POST http://localhost:3001/api/v1/pages \
  -H "Authorization: Bearer USER_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d 'YOUR_JSON_PAYLOAD'
```

**Page creation fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `slug` | Yes | URL-safe identifier (lowercase, hyphens only, e.g. `my-cool-app`) |
| `title` | Yes | Page title |
| `tagline` | No | Short description |
| `themeColor` | No | Hex color (e.g. `#6366F1`) |
| `content` | Yes | Object with `sections` array |
| `privacyPolicy` | No | Markdown text for privacy policy |
| `termsOfService` | No | Markdown text for terms of service |
| `isPublished` | No | Set `true` to publish immediately |

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

### Step 7: Verify and show results

After successful creation, tell the user:

> Your pages are now live:
> - Landing page: http://localhost:3001/p/YOUR_SLUG
> - Privacy policy: http://localhost:3001/p/YOUR_SLUG/privacy
> - Terms of service: http://localhost:3001/p/YOUR_SLUG/terms

Then use `curl` to verify the pages return HTTP 200:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/p/YOUR_SLUG
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

## Important Rules

- `slug`: lowercase alphanumeric with hyphens only (e.g. `my-cool-app`)
- `themeColor`: hex format (e.g. `#6366F1`)
- Free plan limit: 3 pages maximum
- Privacy policy and terms of service use Markdown
- Sections render in `order` sequence (1, 2, 3...)
- You can combine ANY sections in ANY order
- Always include `privacyPolicy` and `termsOfService` — they are required for App Store / Play Store submissions
