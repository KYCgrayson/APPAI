# AIGA — AI Generative Application

A free AI App hosting platform. Get a professional landing page with privacy policy and terms of service in 30 seconds — powered by AI agents.

一個免費的 AI 應用託管平台。讓 AI Agent 自動幫你建立專業的 Landing Page、Privacy Policy 和 Terms of Service，30 秒上線。

## What is AIGA?

AIGA lets AI agents (Claude, GPT, Codex, etc.) create and host landing pages for your apps — no web hosting knowledge needed. Just give your agent an API key, and it handles everything.

**Perfect for:**
- iOS / Android app developers who need a landing page + privacy policy for App Store / Play Store submission
- SaaS builders who want a quick product page
- Anyone who wants a hosted page without dealing with deployment

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/anthropics/aiga.git
cd aiga
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in your DATABASE_URL, NEXTAUTH_SECRET, and Google OAuth credentials

# 3. Push database schema
npx prisma db push

# 4. Run dev server
npm run dev
```

Open http://localhost:3000

## For AI Agents

### Step 1: Get your API key

Sign in at `/login` → go to `/dashboard/settings` → create an API key.

### Step 2: Discover available sections and presets

```bash
# See all available section building blocks
curl https://your-domain.com/api/v1/sections

# See preset templates (pre-configured section combinations)
curl https://your-domain.com/api/v1/presets
```

### Step 3: Create a page

Every page is built from **sections** — modular building blocks you can freely combine.

```bash
curl -X POST https://your-domain.com/api/v1/pages \
  -H "Authorization: Bearer aiga_sk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "my-cool-app",
    "title": "My Cool App",
    "themeColor": "#6366F1",
    "content": {
      "logo": "https://example.com/logo.png",
      "sections": [
        {
          "type": "hero",
          "order": 1,
          "data": {
            "headline": "The Future of Productivity",
            "subheadline": "AI-powered task management",
            "logo": "https://example.com/logo.png",
            "backgroundImage": "https://example.com/hero-bg.jpg",
            "ctaText": "Download Now",
            "ctaUrl": "#download"
          }
        },
        {
          "type": "video",
          "order": 2,
          "data": {
            "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "caption": "See it in action"
          }
        },
        {
          "type": "features",
          "order": 3,
          "data": {
            "items": [
              { "icon": "brain", "title": "AI-Powered", "description": "Smart task prioritization" },
              { "icon": "zap", "title": "Lightning Fast", "description": "Real-time sync across devices" },
              { "icon": "shield", "title": "Secure", "description": "End-to-end encryption" }
            ]
          }
        },
        {
          "type": "download",
          "order": 4,
          "data": {
            "appStoreUrl": "https://apps.apple.com/app/...",
            "playStoreUrl": "https://play.google.com/store/apps/..."
          }
        },
        {
          "type": "faq",
          "order": 5,
          "data": {
            "items": [
              { "question": "Is it free?", "answer": "Yes, the basic plan is completely free." },
              { "question": "Which platforms?", "answer": "iOS, Android, and Web." }
            ]
          }
        }
      ]
    },
    "privacyPolicy": "## Privacy Policy\n\nYour privacy policy content here in Markdown...",
    "termsOfService": "## Terms of Service\n\nYour terms content here in Markdown...",
    "isPublished": true
  }'
```

### Your page is now live at:

| URL | Content |
|-----|---------|
| `/p/my-cool-app` | Landing page |
| `/p/my-cool-app/privacy` | Privacy policy |
| `/p/my-cool-app/terms` | Terms of service |

## Available Sections

These are the building blocks you can use to compose any page:

| Section | Type | Description |
|---------|------|-------------|
| **Hero** | `hero` | Large headline with optional logo, background image/video, and CTA button |
| **Video** | `video` | Embedded video — auto-detects YouTube, Vimeo, mp4, webm, gif |
| **Features** | `features` | Feature cards in a 3-column grid with icons |
| **Screenshots** | `screenshots` | Horizontal scrollable image carousel |
| **Download** | `download` | App Store and Google Play download buttons |
| **Pricing** | `pricing` | Pricing plan comparison cards |
| **Testimonials** | `testimonials` | User testimonial/review cards |
| **FAQ** | `faq` | Expandable question & answer list |
| **Gallery** | `gallery` | Image/video grid for portfolios and showcases |
| **Team** | `team` | Team member cards with photo, role, and bio |
| **Schedule** | `schedule` | Timeline/agenda for events |
| **Sponsors** | `sponsors` | Logo wall for partners and sponsors |
| **Stats** | `stats` | Key metrics displayed prominently (e.g. "10K+ Users") |
| **Contact** | `contact` | Contact information with email, phone, address |
| **CTA** | `cta` | Bold call-to-action banner |
| **Links** | `links` | Linktree-style link button list |
| **About** | `about` | Text content section (supports Markdown) |

## Presets

Presets are pre-configured section combinations. Use them as a starting point, then add or remove sections as needed.

| Preset | Sections | Best For |
|--------|----------|----------|
| **app-landing** | hero → video → features → screenshots → download → testimonials → faq → cta | iOS/Android apps |
| **saas-landing** | hero → video → features → pricing → testimonials → faq → cta | Web tools, APIs, SaaS |
| **profile** | hero → about → stats → contact → links | Personal branding |
| **link-in-bio** | hero → links | Social media link pages |
| **portfolio** | hero → about → gallery → testimonials → contact | Creative work showcase |
| **event** | hero → about → video → schedule → team → pricing → sponsors → faq → cta | Conferences, meetups |

## Section Data Reference

### hero

```json
{
  "type": "hero",
  "data": {
    "headline": "Your App Name",
    "subheadline": "A short tagline",
    "logo": "https://example.com/logo.png",
    "backgroundImage": "https://example.com/bg.jpg",
    "backgroundVideo": "https://example.com/bg.mp4",
    "ctaText": "Get Started",
    "ctaUrl": "https://example.com"
  }
}
```

### video

```json
{
  "type": "video",
  "data": {
    "url": "https://youtube.com/watch?v=...",
    "caption": "Watch the demo"
  }
}
```

Supported formats:
- YouTube / Vimeo links → embedded iframe
- `.mp4` / `.webm` → HTML5 video player
- `.gif` → displayed as image

### features

```json
{
  "type": "features",
  "data": {
    "items": [
      { "icon": "rocket", "title": "Fast", "description": "Blazing fast performance" }
    ]
  }
}
```

Available icons: `brain`, `zap`, `shield`, `star`, `heart`, `globe`, `lock`, `rocket`, `code`, `chart`. You can also use any emoji.

### screenshots

```json
{
  "type": "screenshots",
  "data": {
    "images": ["https://example.com/screen1.png", "https://example.com/screen2.png"]
  }
}
```

### download

```json
{
  "type": "download",
  "data": {
    "appStoreUrl": "https://apps.apple.com/app/...",
    "playStoreUrl": "https://play.google.com/store/apps/...",
    "ctaText": "Download Now"
  }
}
```

### pricing

```json
{
  "type": "pricing",
  "data": {
    "items": [
      {
        "name": "Free",
        "price": "$0",
        "description": "For individuals",
        "features": ["1 project", "Basic support"],
        "ctaText": "Start Free",
        "ctaUrl": "https://example.com/signup"
      },
      {
        "name": "Pro",
        "price": "$9/mo",
        "description": "For teams",
        "features": ["Unlimited projects", "Priority support", "Custom domain"],
        "highlighted": true,
        "ctaText": "Upgrade",
        "ctaUrl": "https://example.com/upgrade"
      }
    ]
  }
}
```

### testimonials

```json
{
  "type": "testimonials",
  "data": {
    "items": [
      {
        "name": "Jane Doe",
        "role": "CEO at TechCorp",
        "avatar": "https://example.com/avatar.jpg",
        "quote": "This product changed our workflow completely."
      }
    ]
  }
}
```

### faq

```json
{
  "type": "faq",
  "data": {
    "items": [
      { "question": "Is it free?", "answer": "Yes, the basic plan is free forever." }
    ]
  }
}
```

### gallery

```json
{
  "type": "gallery",
  "data": {
    "items": [
      { "url": "https://example.com/work1.jpg", "caption": "Project Alpha", "type": "image" },
      { "url": "https://example.com/demo.mp4", "caption": "Demo Video", "type": "video" }
    ]
  }
}
```

### team

```json
{
  "type": "team",
  "data": {
    "items": [
      { "name": "Alice", "role": "CEO", "photo": "https://example.com/alice.jpg", "bio": "10 years in tech" }
    ]
  }
}
```

### schedule

```json
{
  "type": "schedule",
  "data": {
    "items": [
      { "time": "10:00 AM", "title": "Opening Keynote", "speaker": "John Smith", "description": "Welcome and vision" }
    ]
  }
}
```

### sponsors

```json
{
  "type": "sponsors",
  "data": {
    "items": [
      { "name": "Acme Corp", "logo": "https://example.com/acme-logo.png", "url": "https://acme.com" }
    ]
  }
}
```

### stats

```json
{
  "type": "stats",
  "data": {
    "items": [
      { "value": "10K+", "label": "Users" },
      { "value": "99.9%", "label": "Uptime" },
      { "value": "50ms", "label": "Response Time" }
    ]
  }
}
```

### contact

```json
{
  "type": "contact",
  "data": {
    "email": "hello@example.com",
    "phone": "+1-555-0123",
    "address": "123 Main St, City",
    "formUrl": "https://forms.google.com/..."
  }
}
```

### cta

```json
{
  "type": "cta",
  "data": {
    "headline": "Ready to get started?",
    "subheadline": "Join thousands of happy users",
    "buttonText": "Sign Up Free",
    "buttonUrl": "https://example.com/signup"
  }
}
```

### links

```json
{
  "type": "links",
  "data": {
    "items": [
      { "title": "My Website", "url": "https://example.com", "icon": "🌐", "style": "filled" },
      { "title": "GitHub", "url": "https://github.com/...", "icon": "💻", "style": "outlined" }
    ]
  }
}
```

### about

```json
{
  "type": "about",
  "data": {
    "heading": "Our Story",
    "text": "We started in 2024 with a simple idea..."
  }
}
```

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/sections` | None | List all available section types and their fields |
| `GET` | `/api/v1/presets` | None | List all presets with section details |
| `POST` | `/api/v1/pages` | Bearer | Create a new page |
| `GET` | `/api/v1/pages` | Bearer | List your pages |
| `GET` | `/api/v1/pages/:slug` | Bearer | Get a page |
| `PUT` | `/api/v1/pages/:slug` | Bearer | Update a page |
| `DELETE` | `/api/v1/pages/:slug` | Bearer | Delete a page |
| `POST` | `/api/v1/pages/:slug/publish` | Bearer | Publish a page |
| `POST` | `/api/v1/pages/:slug/unpublish` | Bearer | Unpublish a page |
| `POST` | `/api/v1/apps` | Bearer | Submit an app |
| `GET` | `/api/v1/apps` | Bearer | List your apps |
| `POST` | `/api/v1/keys` | Session | Create API key |
| `GET` | `/api/v1/keys` | Session | List API keys |
| `DELETE` | `/api/v1/keys` | Session | Revoke API key |

## Tech Stack

- **Next.js 16** — Full-stack React framework
- **Tailwind CSS 4** — Utility-first styling
- **shadcn/ui** — UI components
- **Prisma + Neon** — PostgreSQL database
- **NextAuth.js** — Google OAuth authentication

## License

MIT
