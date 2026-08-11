# TODO — AppAI Project Roadmap

## Product decisions (settled — do not re-litigate)

Recorded so future work stops re-deriving them. The boundary itself lives in
`CLAUDE.md` → Product Boundary.

| # | Decision | Ruling |
|---|---|---|
| D1 | Are app names translated? | **Yes, when the app published a page in that language.** A visitor reading Traditional Chinese sees the app's Traditional Chinese name — the `HostedPage.title` for that locale. Falls back to `App.name` as submitted when no variant exists. (Considered and rejected: App Store convention of never translating brand names. On AppAI the "name" is publisher-supplied copy, not a trademark, and a directory of English names is unreadable to the audience the hosted page was written for.) |
| D2 | Where does localized app copy live? | **`HostedPage` rows now, `App.translations` later.** `HostedPage` is already one row per locale, so apps with a hosted page get localized copy for free. Apps without one stay single-language until D2b ships. |
| D3 | Platform has 9 locales, hosted pages accept any BCP 47 code | **Keep them different.** Platform UI is ours to translate; hosted-page locales come from the publishing agent. Resolve across the gap with `pickByLocale` (exact → primary subtag → default) rather than unifying. |

### Open decisions (need an owner call)

- [ ] **D2b — add `App.translations`** JSON column + `createAppSchema` support + `AGENT_INSTRUCTIONS.md`, so agents can publish multi-language name/tagline for apps with no hosted page. Needs a Prisma migration against production.
- [ ] **D4 — locale in the Universal App runtime contract.** An artifact is someone else's code; AppAI cannot translate it. Proposal: pass the visitor locale as runtime context and declare it in `appai.app.json`, artifact owns its strings. Decide before more artifacts ship or they all hardcode English.
- [ ] **D5 — `iframe-tool` depends on infrastructure we do not control.** If the user's Vercel deploy dies the AppAI page shows a broken frame and reads as our outage. Proposal: health check + graceful degradation (keep the landing content, hide the frame, notify the owner). Real scope addition, not free.
- [ ] **D6 — Universal App review is manual.** Every release needs admin approval. That is the scope brake that keeps AppAI from becoming a general code host, but it is also the growth ceiling. Revisit once more than a handful of artifacts exist.

## Platform i18n — directory localization

- [x] Translate app categories + landing-page badge across all 9 platform locales
- [x] Add `pickByLocale` (`src/lib/locale-match.ts`) and source directory copy from the visitor's `HostedPage` locale variant
- [ ] Audit remaining platform surfaces for publisher-supplied English (D2b covers apps with no hosted page)

## Universal App Runtime — Simpleshop migration

- [x] Correct the boundary: AppAI is the Universal carrier; app UI/API/business schema stay in each app repo
- [x] Add strict `appai.app.json` validation plus versioned release and platform-controlled deployment records
- [x] Add generic `/app/[appId]` launch, one-time code exchange, opaque runtime sessions, and capability introspection
- [x] Add generic private image/PDF runtime APIs scoped by app + Organization
- [x] Rehearse, apply, and schema-diff the additive Universal runtime migration
- [x] Verify an isolated Simpleshop test database with separate migration and CRUD-only runtime roles
- [x] Move new Simpleshop customer/job-site implementation and migrations into the Simpleshop repo
- [ ] Add isolated artifact build/provisioning worker and app-scoped PostgreSQL credential injection
- [ ] Register, build, deploy, and accept the independent Simpleshop artifact
- [x] Add reversible `/app/simpleshop` Universal runtime cutover gate: redirect only for an `APPROVED` release with an `ACTIVE` `PRODUCTION` deployment; otherwise retain compatibility UI
- [ ] Remove hardcoded Simpleshop pages/APIs/services/models only after data migration and rollback acceptance

### Historical monolith work (compatibility layer)

- [x] Protect and commit the existing `simple-order` work before updating from remote main
- [x] Add the original code registry and Organization-scoped `OrganizationApp`
- [x] Add protected `/app/simpleshop` shell, primary modules, settings persistence, and reusable lookup contract
- [x] Add private image/PDF metadata, authenticated streaming, deletion audit, and quota thresholds
- [x] Add native-app admin monitoring and API-key instance activation
- [x] Rehearse and apply `prisma/native-app-phase1-migration.sql` against production with the direct Neon connection
- [x] Verify two-Organization database isolation with a forced-rollback production transaction
- [ ] Verify authenticated private Blob upload/download and direct-URL denial
- [x] Begin Phase 2 Customer, JobSite, Item, alias, unit, and price master data from the Simpleshop PRD
- [x] Rehearse, apply, and verify the Phase 2 master-data migration against production Neon
- [x] Deploy and verify the Phase 2 APIs and management screens on `appai.info`

Central todolist for all planned features, improvements, and tasks.
Check items off as they are completed. Add new items with date and description.

---

## Website Scanner Tools (for all users)

> **Added:** 2026-03-30
> **Goal:** Build a set of website scanning tools in Dashboard that all authenticated users can access. Users input a URL, click Scan, and get a diagnostic report. Start with predefined logic (no LLM cost), optionally upgrade to LLM-enhanced summaries later.

### Phase 1 — Core Scanner (predefined logic, no LLM)

- [ ] Remove admin-only restriction on `/dashboard/tools` nav link
- [ ] Create `/dashboard/tools/scanner` page — unified Website Scanner UI
- [ ] **SEO Audit** — scan meta tags, title, h1 structure, og tags, canonical, sitemap.xml, robots.txt
- [ ] **AI Readiness** — check llms.txt, /.well-known/ai-plugin.json, schema markup, API endpoints, MCP server
- [ ] **Structured Data** — parse JSON-LD, microdata, Open Graph
- [ ] **Performance** — page size, image optimization, basic Core Web Vitals
- [ ] API route: `POST /api/v1/tools/scan` — accepts URL, returns structured results
- [ ] Rate limiting per user/organization (FREE plan: X scans/day)
- [ ] Results display as a scored report card with pass/fail per item

### Phase 2 — LLM-Enhanced Reports (optional upgrade)

- [ ] Send scan results to LLM for human-readable summary and improvement suggestions
- [ ] Store scan history per organization in database (new Prisma model)
- [ ] Compare scans over time (before/after improvements)

### Phase 3 — Community Features

- [ ] AI Tools Directory — browsable list of AI tools
- [ ] User submissions — authenticated users can submit tools for review
- [ ] Admin approval workflow for submitted tools

---

## Existing Tools

- [x] YouTube/Media Download Tool (admin-only, hosted on NAS via Docker + Cloudflare Tunnel)
- [x] `media-downloader` section type — public, interactive download tool embeddable in any landing page via API
