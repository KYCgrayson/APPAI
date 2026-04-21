# CLAUDE.md — Project Guidelines for AI Assistants

## Security Rules (CRITICAL)

This is a **public repository**. All files, commits, and history are visible to everyone.

- **NEVER** commit API keys, tokens, secrets, or credentials to the repo
- **NEVER** commit `.env`, `.env.local`, or any file containing secrets
- **NEVER** include personal information (emails, phone numbers, addresses) in code or commits
- **NEVER** expose internal infrastructure details (database URLs, server IPs, admin endpoints logic)
- **NEVER** include user data or production database contents in code
- API keys shown in AGENT_INSTRUCTIONS.md must use placeholder format: `appai_sk_YOUR_KEY`
- The `scripts/create-demo-pages.sh` requires `API_KEY` env var — never hardcode it

## Product Overview

**AppAI** (appai.info) is a free hosting platform for AI-built apps. The core value: AI agents can create fully functional, multi-language landing pages with a single API call.

### How It Works

1. AI agent authenticates via Device Authorization flow → gets an API key (`appai_sk_...`)
2. Agent calls `POST /api/v1/pages` with page content (title, sections, SEO metadata, etc.)
3. Page is immediately live at `appai.info/p/{slug}` with automatic i18n, SEO, privacy/terms pages
4. Supports 22 section types (hero, features, pricing, FAQ, gallery, form, media-downloader, etc.) and 6 templates
5. Visual design system: dark mode, custom Google Fonts, color palettes, hero variants (centered/split/minimal), per-section backgroundColor
6. Multi-page sites supported (root + child pages like /faq, /contact, /privacy)

### Who Uses It

- **AI agents** (primary): Create landing pages programmatically via API. See `AGENT_INSTRUCTIONS.md` for the full agent-facing spec.
- **Users**: Sign up via Google OAuth, manage pages in Dashboard, access tools.
- **Admin**: Internal admin panel for managing all pages and users.

### Related Repositories

- **my-tools** (Private Repo, github.com/KYCgrayson/my-tools): Standalone tools (media downloader, etc.) deployed separately on Vercel. Source code is private to avoid legal exposure. AIGA creates landing pages that link to the deployed tool URLs.

### Infrastructure

- **Frontend + API**: This repo, deployed on Vercel (auto-deploy from `main`)
- **Database**: PostgreSQL on Neon, managed via Prisma
- **Media Downloader backend**: yt-dlp running on NAS via Docker, exposed through a named Cloudflare Tunnel at `ytdlp.myaiapp.uk`. `MediaDownloaderSection` calls it directly from the browser; the backend has `CORSMiddleware allow_origins=["*"]` and accepts the API token via header (`/download`) or `?token=` query param (`/file/{id}`, so `<a download>` works). Product spec lives in my-tools repo.

## Key Architecture

- **Next.js 16** App Router + React 19
- **next-intl** for platform i18n (9 languages: en, ja, ko, zh-CN, zh-TW, de, fr, es, hi)
- **Prisma** + PostgreSQL (Neon) for data
- **NextAuth.js** for Google OAuth
- **Vercel** for hosting, auto-deploys from `main` branch

## Route Structure

- `/[locale]/` — Public pages (i18n enabled)
- `/dashboard/` — Authenticated user area (English only)
- `/admin/` — Admin panel (English only)
- `/p/[...segments]` — Hosted pages (own locale system, 30+ languages)
- `/api/` — API endpoints

## Project Docs

- **TODO.md** — Central todolist and roadmap. All planned features, tasks, and progress are tracked here. Always check and update this file when working on new features or completing tasks.
- **AGENT_INSTRUCTIONS.md** — Complete spec for AI agents: capability overview, visual design guide, authentication flow, API endpoints, section types, content format, multi-page sites, and multi-language support. Redesigned with a "designer mindset" — agents build first, iterate after.

## AGENT_INSTRUCTIONS.md Style Rules

This file is the most important entry point for external AI agents. Keep it tight:
- **Tables and one-liners over paragraphs.** If it can be a table row, don't write a paragraph.
- **Capability-first.** The first 300 lines tell agents what they CAN do. Details come after.
- **No unnecessary statements.** Every line must earn its place. Target: under 700 lines total.
- **Agent is a designer, not a form-filler.** Instructions should empower agents to build autonomously, not ask the user 10 questions before starting.

## Conventions

- Commit messages: concise, describe the "why"
- Co-author tag: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Always `npm run build` before pushing to catch errors
- Dashboard/admin pages stay in English — do NOT add i18n
- Hosted pages (`/p/`) have their own locale system — do NOT mix with platform i18n
