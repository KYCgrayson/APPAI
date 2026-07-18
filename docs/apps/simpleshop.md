# Simpleshop native app integration

| Item | Adopted value |
|---|---|
| Product source of truth | `Simpleshop/simpleshop-PRD.md` |
| Product specification | Simpleshop PRD v2.5 |
| Simpleshop handoff commit | `3ca78d1` |
| Platform specifications | AppAI platform changes v1.1; Simpleshop app scope v1.1 |
| Native app type | `simpleshop` |
| Runtime | `/app/simpleshop` |
| Current implementation | AppAI Phase 1 code complete; infrastructure verification pending on `codex/simpleshop-native-app` |

The complete product PRD stays in the Simpleshop repository. This document records only the AppAI integration contract and deployment state.

## Platform contract

- `simpleshop` is a code-approved native app. It is not a `HostedPage`, `simple-order` section, connector upload, or arbitrary server program.
- Authentication uses the existing Google OAuth / NextAuth session.
- The server derives `userId` and `organizationId`; browser bodies and query strings cannot select an Organization.
- First access idempotently creates one `OrganizationApp`. `SUSPENDED` instances remain suspended and protected APIs return 403.
- Organization settings are stored in the validated, versioned `OrganizationApp.config` object during Phase 1. Customer, job-site, item and accounting records will use dedicated Organization-scoped tables from Phase 2 onward.
- Private files are metadata-owned by `PrivateAsset` and streamed through authenticated AppAI routes. Blob URLs are not returned to clients.

## Approved APIs

| Method and path | Identity | Purpose |
|---|---|---|
| `GET /api/v1/app-instances` | Bearer API key | List enabled instances for the key's Organization |
| `POST /api/v1/app-instances` | Bearer API key | Idempotently enable an approved app type |
| `GET /api/apps/simpleshop/status` | Browser session | Read the current Organization's active instance |
| `GET/PATCH /api/apps/simpleshop/settings` | Browser session | Read/update validated shop, timezone, currency and print settings |
| `GET /api/apps/simpleshop/lookups` | Browser session | Phase 1 typed customer/job-site/item lookup boundary |
| `POST /api/apps/simpleshop/assets` | Browser session | Authorize and upload a private image or PDF |
| `GET/DELETE /api/apps/simpleshop/assets/:id` | Browser session | Stream or safely delete an Organization-owned asset |

Agents may enable `simpleshop` and update the documented settings for their own Organization. Agents may not send `organizationId`, choose runtime paths/components, create schemas, execute SQL, upload server code, or change secrets.

## Prisma and deployment

Models added by Phase 1:

- `OrganizationApp` with composite uniqueness on `organizationId + appType`.
- `PrivateAsset` with Organization/app ownership, byte metadata and auditable deletion state.
- Optional `UsageEvent.organizationId` for native-app monitoring.
- `App.appType` and `App.runtimePath` for future catalog synchronization; the code registry remains authoritative.

Review and apply `prisma/native-app-phase1-migration.sql` with the direct, non-pooled production database connection before deploying application code. `npm run build` generates Prisma Client but does not apply database changes.

## Environment and dashboard requirements

```text
PRIVATE_BLOB_READ_WRITE_TOKEN=
SIMPLESHOP_PRIVATE_ASSET_MAX_FILE_BYTES=2097152
SIMPLESHOP_PRIVATE_ASSET_ORG_LIMIT_BYTES=104857600
SIMPLESHOP_PRIVATE_ASSET_LARGE_FILE_BYTES=524288
```

`PRIVATE_BLOB_READ_WRITE_TOKEN` must belong to a Vercel Blob store configured for private access. Do not reuse the public landing-page upload token. Provider-level Neon storage/compute and Blob transfer metrics remain checks in their dashboards until dedicated billing API credentials are approved.

Threshold behavior:

- 60%: warning.
- 80%: review and upgrade planning.
- 95%: reject new large files.
- 100% projected usage: reject all uploads.

## Phase 1 application surface

The protected shell exposes three primary modules—Shipping, Monthly Settlement and Customer Contact—and secondary Items, Pricing, Inventory and Settings routes. The settings form is the first persistent management slice. Customer, job-site and item selectors share one dialog contract and explicitly show that Phase 2 master data is not yet available; no fake accounting or catalog data is created.

## Verification status

- Prisma format/validation/generation: passed on 2026-07-18.
- Native app, redirect, mutation-origin, settings, simple-order and private asset tests: 11 defined; 10 passed and the database integration test skipped without `TEST_DATABASE_URL`.
- Type check: passed.
- Production build: passed; all native app pages and APIs appear in the Next.js route manifest.
- ESLint on every changed TypeScript/TSX path: 0 errors, 2 existing `img` optimization warnings. The repository-wide lint remains blocked by an existing baseline of 80 errors and 44 warnings outside this feature scope.
- Anonymous browser verification: `/app/simpleshop/shipping` redirects through the locale login page while preserving the exact callback; protected settings, app-instance and asset APIs return 401; browser console has no errors.
- Two-Organization database isolation: requires a non-production `TEST_DATABASE_URL` and applied migration.
- Private Blob end-to-end upload/download: requires private Blob credentials.
- Authenticated desktop/mobile runtime verification: requires two test logins after the migration is applied.

Phase 1 must not be declared complete until the final verification results replace these pending entries.

## Work remaining before Phase 2 business development

- Apply and rehearse the SQL migration in a non-production database, then production.
- Configure the private Blob store and verify direct Blob URLs remain inaccessible.
- Run two-Organization database and browser acceptance tests.
- Verify simultaneous upload behavior against the configured Organization quota under expected production concurrency.
- Begin dedicated `Customer`, `JobSite`, `Item`, alias, unit and price tables only after Phase 1 isolation passes.
