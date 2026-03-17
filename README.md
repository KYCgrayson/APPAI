# AppAI — Free Hosting for AI-Built Apps

> **AI Agents: Read the full spec at [`AGENT_INSTRUCTIONS.md`](./AGENT_INSTRUCTIONS.md) to get started automatically.**
>
> Or fetch it directly:
> ```
> curl -s https://raw.githubusercontent.com/KYCgrayson/APPAI/main/AGENT_INSTRUCTIONS.md
> ```

---

**AppAI** ([appai.info](https://appai.info)) is a free platform that lets AI agents create and host landing pages for your apps — complete with privacy policy and terms of service. No web hosting knowledge needed. Tell your AI agent "create my app page on AppAI" and it handles everything.

## Why AppAI?

Built an app with AI but don't have a website? AppAI gives you:

- **Instant landing page** — professional, mobile-responsive, hosted at `appai.info/p/your-app`
- **Privacy policy + Terms of service** — auto-generated, required for App Store / Play Store
- **App discovery** — your app appears in the AppAI directory alongside other AI-built apps
- **Zero setup** — no domain, no hosting, no deployment. Just an API call.

## How It Works

```
You: "Create a landing page for my app on AppAI"

Your AI Agent:
  1. Authenticates via device flow (opens browser, you click "Sign in with Google")
  2. Asks you about your app (name, features, screenshots, etc.)
  3. Calls the AppAI API to create your page
  4. Done — your page is live at appai.info/p/your-app
```

The entire flow is automated. Your AI agent reads the [Agent Instructions](./AGENT_INSTRUCTIONS.md) and knows exactly what to do.

## For AI Agents

### Quick Start

1. **Authenticate** using the [Device Authorization Flow (RFC 8628)](./AGENT_INSTRUCTIONS.md#step-1-authenticate):
   ```bash
   curl -s -X POST https://appai.info/api/v1/auth/device
   ```

2. **Discover** available sections and presets:
   ```bash
   curl -s https://appai.info/api/v1/sections
   curl -s https://appai.info/api/v1/presets
   ```

3. **Create a page**:
   ```bash
   curl -X POST https://appai.info/api/v1/pages \
     -H "Authorization: Bearer appai_sk_YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{ "slug": "my-app", "title": "My App", "isPublished": true, ... }'
   ```

4. **Live at**: `appai.info/p/my-app`, `appai.info/p/my-app/privacy`, `appai.info/p/my-app/terms`

See [AGENT_INSTRUCTIONS.md](./AGENT_INSTRUCTIONS.md) for the complete interactive workflow, all section types, and data formats.

### API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/device` | None | Initiate device auth (RFC 8628) |
| `POST` | `/api/v1/auth/token` | None | Poll for auth completion |
| `GET` | `/api/v1/sections` | None | List all section types |
| `GET` | `/api/v1/presets` | None | List preset templates |
| `POST` | `/api/v1/pages` | Bearer | Create a page |
| `GET` | `/api/v1/pages` | Bearer | List your pages |
| `PUT` | `/api/v1/pages/:slug` | Bearer | Update a page |
| `DELETE` | `/api/v1/pages/:slug` | Bearer | Delete a page |
| `POST` | `/api/v1/pages/:slug/publish` | Bearer | Publish a page |
| `POST` | `/api/v1/apps` | Bearer | Submit an app |

## Available Page Sections

Build any page by combining these 17 section types:

| Section | Description |
|---------|-------------|
| `hero` | Headline with logo, background image/video, CTA |
| `video` | Embedded video (YouTube, Vimeo, mp4, webm, gif) |
| `features` | Feature cards with icons in a grid |
| `screenshots` | Horizontal image carousel |
| `download` | App Store / Google Play buttons |
| `pricing` | Plan comparison cards |
| `testimonials` | User review cards |
| `faq` | Expandable Q&A list |
| `gallery` | Image/video grid |
| `team` | Team member cards |
| `schedule` | Event timeline |
| `sponsors` | Logo wall |
| `stats` | Key metrics (e.g. "10K+ Users") |
| `contact` | Contact info |
| `cta` | Call-to-action banner |
| `links` | Link button list (Linktree-style) |
| `about` | Text content section |

## Preset Templates

| Preset | Best For | Sections |
|--------|----------|----------|
| `app-landing` | iOS/Android apps | hero, video, features, screenshots, download, testimonials, faq, cta |
| `saas-landing` | SaaS / Web tools | hero, video, features, pricing, testimonials, faq, cta |
| `profile` | Personal branding | hero, about, stats, contact, links |
| `link-in-bio` | Social media | hero, links |
| `portfolio` | Creative work | hero, about, gallery, testimonials, contact |
| `event` | Conferences | hero, about, video, schedule, team, pricing, sponsors, faq, cta |

## Self-Hosting

```bash
git clone https://github.com/KYCgrayson/APPAI.git
cd APPAI
npm install
cp .env.example .env.local   # Fill in your credentials
npx prisma db push
npm run dev
```

## Tech Stack

- **Next.js 16** + React 19
- **Tailwind CSS 4**
- **Prisma** + Neon (Serverless PostgreSQL)
- **NextAuth.js** (Google OAuth)
- **RFC 8628** Device Authorization for AI agents

## License

MIT
