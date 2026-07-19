# Simpleshop native app integration

| Item | Adopted value |
|---|---|
| Product source of truth | `Simpleshop/simpleshop-PRD.md` |
| Product specification | Simpleshop PRD v2.5 |
| Simpleshop handoff commit | `10a9b75` |
| Platform specifications | AppAI platform changes v1.1; Simpleshop app scope v1.1 |
| Native app type | `simpleshop` |
| Runtime | `/app/simpleshop` |
| Current implementation | Phase 1 deployed in production at `e251350`; Phase 2 master-data management is in development on `codex/simpleshop-master-data` |

The complete product PRD stays in the Simpleshop repository. This document records only the AppAI integration contract and deployment state.

## Platform contract

- `simpleshop` is a code-approved native app. It is not a `HostedPage`, `simple-order` section, connector upload, or arbitrary server program.
- Authentication uses the existing Google OAuth / NextAuth session.
- The server derives `userId` and `organizationId`; browser bodies and query strings cannot select an Organization.
- First access idempotently creates one `OrganizationApp`. `SUSPENDED` instances remain suspended and protected APIs return 403.
- Organization settings are stored in the validated, versioned `OrganizationApp.config` object. Phase 2 customer, job-site, item, alias, unit and price records use dedicated Organization-scoped tables with composite foreign keys.
- Private files are metadata-owned by `PrivateAsset` and streamed through authenticated AppAI routes. Blob URLs are not returned to clients.

## Approved APIs

| Method and path | Identity | Purpose |
|---|---|---|
| `GET /api/v1/app-instances` | Bearer API key | List enabled instances for the key's Organization |
| `POST /api/v1/app-instances` | Bearer API key | Idempotently enable an approved app type |
| `GET /api/apps/simpleshop/status` | Browser session | Read the current Organization's active instance |
| `GET/PATCH /api/apps/simpleshop/settings` | Browser session | Read/update validated shop, timezone, currency and print settings |
| `GET /api/apps/simpleshop/lookups` | Browser session | Search real customer/job-site/item master data |
| `GET/POST /api/apps/simpleshop/customers` | Browser session | List/search customers and allocate a permanent customer number |
| `GET/PATCH/DELETE /api/apps/simpleshop/customers/:id` | Browser session | Read/update or soft-disable an Organization-owned customer |
| `GET/POST /api/apps/simpleshop/job-sites` | Browser session | List/search job sites and allocate the current month's site number |
| `GET/PATCH/DELETE /api/apps/simpleshop/job-sites/:id` | Browser session | Read/update or soft-disable an Organization-owned job site |
| `GET/POST /api/apps/simpleshop/items` | Browser session | List/search and create item, category, alias and unit records |
| `GET/PATCH/DELETE /api/apps/simpleshop/items/:id` | Browser session | Read/update or soft-disable an Organization-owned item |
| `POST /api/apps/simpleshop/assets` | Browser session | Authorize and upload a private image or PDF |
| `GET/DELETE /api/apps/simpleshop/assets/:id` | Browser session | Stream or safely delete an Organization-owned asset |

Agents may enable `simpleshop` and update the documented settings for their own Organization. Agents may not send `organizationId`, choose runtime paths/components, create schemas, execute SQL, upload server code, or change secrets.

## Prisma and deployment

Models added by Phase 1:

- `OrganizationApp` with composite uniqueness on `organizationId + appType`.
- `PrivateAsset` with Organization/app ownership, byte metadata and auditable deletion state.
- Optional `UsageEvent.organizationId` for native-app monitoring.
- `App.appType` and `App.runtimePath` for future catalog synchronization; the code registry remains authoritative.

`prisma/native-app-phase1-migration.sql` was applied with the direct, non-pooled production database connection on 2026-07-19 after a successful transaction rollback rehearsal. `npm run build` generates Prisma Client but does not apply database changes.

Phase 2 adds `SimpleshopSequence`, `Customer`, `JobSite`, `JobSiteAlias`, `JobSiteMonthCode`, `ItemCategory`, `Item`, `ItemAlias`, `ItemUnit`, `PriceRecord` and `CustomerContact`. `prisma/simpleshop-phase2-master-data-migration.sql` is transaction-wrapped and carries database checks for status enums, dimensions, prices and effective dates. Organization ownership is part of every relationship foreign key, not only an application-level query filter. The migration was rehearsed with a forced rollback and applied through the direct production Neon connection on 2026-07-19; a post-apply Prisma diff reports no schema difference.

## Environment and dashboard requirements

```text
# Auto-managed by Vercel after connecting the private store:
BLOB_STORE_ID=<managed by Vercel>
# Optional only for local or non-Vercel verification:
PRIVATE_BLOB_READ_WRITE_TOKEN=
SIMPLESHOP_PRIVATE_ASSET_MAX_FILE_BYTES=2097152
SIMPLESHOP_PRIVATE_ASSET_ORG_LIMIT_BYTES=104857600
SIMPLESHOP_PRIVATE_ASSET_LARGE_FILE_BYTES=524288
```

The private `appai-simpleshop-private` Blob store is connected to the AppAI Vercel project in `SIN1`. Vercel deployments use short-lived OIDC authentication with the auto-managed `BLOB_STORE_ID`; `PRIVATE_BLOB_READ_WRITE_TOKEN` is an optional fallback only for local or non-Vercel verification. Do not reuse the public landing-page upload token. Provider-level Neon storage/compute and Blob transfer metrics remain checks in their dashboards until dedicated billing API credentials are approved.

Threshold behavior:

- 60%: warning.
- 80%: review and upgrade planning.
- 95%: reject new large files.
- 100% projected usage: reject all uploads.

## Application surface

The protected shell exposes three primary modules—Shipping, Monthly Settlement and Customer Contact—and secondary Items, Pricing, Inventory and Settings routes. Settings are persistent. Customer Contact now manages customer and job-site master data; Items manages formal item codes, categories, dimensions, aliases and units. The shared selectors query these real records and create no fake accounting or catalog data.

## Verification status

- Prisma format/validation/generation: passed on 2026-07-19.
- Native app, redirect, mutation-origin, settings, master-data validation, simple-order and private asset tests: 14 defined; 12 passed and two database integration tests skipped without `TEST_DATABASE_URL`.
- Type check: passed.
- Production build: passed; all native app pages and APIs appear in the Next.js route manifest.
- ESLint on every changed TypeScript/TSX path: 0 errors, 2 existing `img` optimization warnings. The repository-wide lint remains blocked by an existing baseline of 80 errors and 44 warnings outside this feature scope.
- Anonymous browser verification: `/app/simpleshop/shipping` redirects through the locale login page while preserving the exact callback; protected settings, app-instance and asset APIs return 401; browser console has no errors.
- Production-shape SQL rollback rehearsal and migration: passed against the direct Neon connection. Post-migration verification confirmed all Phase 1 tables, columns, indexes, checks and foreign keys.
- Two-Organization database isolation: passed in one forced-rollback production transaction for `OrganizationApp` and `PrivateAsset`; no test Organization remained. The persistent test suite still requires a non-production `TEST_DATABASE_URL`.
- Phase 2 SQL rollback rehearsal, production migration and schema diff: passed. All 11 master-data tables and 56 relevant checks/foreign keys were visible. Separate forced-rollback transactions confirmed cross-Organization relationships are rejected and scoped reads return no foreign rows; no test Organization remained.
- Private Blob end-to-end upload/download: private store and Vercel OIDC connection are configured; authenticated route verification remains pending.
- Authenticated desktop/mobile runtime verification: requires two test logins.

The Phase 1 platform foundation is deployed. Private Blob acceptance and multi-login browser acceptance remain explicit verification work rather than blockers for additive Phase 2 master data.

## Remaining acceptance and Phase 2 work

- Verify authenticated private Blob upload/download and confirm direct Blob URLs remain inaccessible.
- Run two-Organization authenticated browser acceptance tests.
- Verify simultaneous upload behavior against the configured Organization quota under expected production concurrency.
- Deploy and verify the Phase 2 management APIs and screens.
- Add price-record and customer-contact-log management screens on top of the tables introduced in this slice.
