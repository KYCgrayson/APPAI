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

## Project Overview

AppAI (appai.info) — Free hosting platform for AI-built apps. AI agents create landing pages via API.

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

## Conventions

- Commit messages: concise, describe the "why"
- Co-author tag: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Always `npm run build` before pushing to catch errors
- Dashboard/admin pages stay in English — do NOT add i18n
- Hosted pages (`/p/`) have their own locale system — do NOT mix with platform i18n
