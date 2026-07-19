# TODO — AppAI Project Roadmap

## Universal App Runtime — Simpleshop migration

- [x] Correct the boundary: AppAI is the Universal carrier; app UI/API/business schema stay in each app repo
- [x] Add strict `appai.app.json` validation plus versioned release and platform-controlled deployment records
- [x] Add generic `/app/[appId]` launch, one-time code exchange, opaque runtime sessions, and capability introspection
- [x] Add generic private image/PDF runtime APIs scoped by app + Organization
- [x] Move new Simpleshop customer/job-site implementation and migrations into the Simpleshop repo
- [ ] Add isolated artifact build/provisioning worker and app-scoped PostgreSQL credential injection
- [ ] Register, build, deploy, and accept the independent Simpleshop artifact
- [ ] Switch `/app/simpleshop` from the compatibility layer to the Universal launcher
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
