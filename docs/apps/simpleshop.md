# Simpleshop Universal App integration

| Item | Adopted value |
|---|---|
| Product source of truth | `Simpleshop/simpleshop-PRD.md` |
| Product specification | Simpleshop PRD v2.6 |
| Adopted Simpleshop commit | `94ee18e` |
| Platform specification | Universal App platform changes v2.0 |
| App id | `simpleshop` |
| Public entry | `/app/simpleshop` |
| App manifest | `Simpleshop/appai.app.json` |
| Current state | Independent runtime and first customer/job-site slice implemented; platform migration in progress |

The complete product PRD stays in the Simpleshop repository. This document records the platform integration and the transition away from the earlier AppAI monolith implementation.

## Correct architecture

- Simpleshop is an independent app artifact. Its UI, API, business rules, Prisma schema, migrations, tests, and release manifest live in the Simpleshop repo.
- AppAI is the Universal carrier. It owns authentication, Organization identity, app release/deployment state, capability grants, launch sessions, private assets, quota, usage, health, and rollback.
- AppAI does not import Simpleshop server code or add future Simpleshop business models and routes to its Next.js process.
- `organizationId` comes only from a short-lived AppAI runtime session. Browser payloads cannot select an Organization.
- The production app database is app-scoped and provisioned by AppAI, while its schema and migrations remain owned by Simpleshop.
- Private image/PDF access uses the generic `private-assets` runtime capability; Blob URLs and storage credentials are never returned to the app browser.

## Universal runtime contract

`Simpleshop/appai.app.json` declares the Node build/start commands, health path, entry/callback paths, version, and these capabilities:

- `identity`
- `database`
- `private-assets`

| Method and path | Identity | Purpose |
|---|---|---|
| `POST /api/v1/apps/simpleshop/releases` | Agent API key | Submit a strict versioned manifest for review |
| `GET /app/simpleshop` | Browser session | Select the active deployment and issue a one-time launch code |
| `POST /api/runtime/sessions/exchange` | One-time launch code | Consume the code and return an opaque eight-hour runtime token |
| `POST /api/runtime/sessions/introspect` | Runtime token | Resolve app, instance, user, Organization, grants, and expiry |
| `POST /api/runtime/assets` | Runtime token | Validate and upload a private image/PDF under app + Organization quota |
| `GET/DELETE /api/runtime/assets/:id` | Runtime token | Stream or delete only an asset owned by that app + Organization |

Launch codes and runtime tokens are stored only as SHA-256 hashes. Launch codes expire after one minute and are consumed with a guarded transaction. The runtime token is bound to the approved app release/deployment and becomes invalid when the instance, grant, release, or deployment is suspended.

## Platform records

The Universal runtime migration adds only generic platform tables:

- `AppRelease`
- `AppDeployment`
- `AppCapabilityGrant`
- `AppLaunchCode`
- `AppRuntimeSession`

The transaction-wrapped migration is `prisma/universal-app-runtime-migration.sql`. It does not remove or alter the existing Simpleshop compatibility tables.

## Independent Simpleshop runtime

The Simpleshop repository now contains:

- a standalone Next.js app that builds without importing AppAI code;
- a strict `appai.app.json`;
- AppAI launch-code callback and session introspection client;
- app-owned Prisma schema and initial migration;
- Organization-scoped customer and job-site CRUD plus a working management UI;
- validation tests proving browser input cannot inject `organizationId` or permanent customer codes.

## Safe transition

The hardcoded Simpleshop pages, APIs, services, and business tables currently deployed in AppAI are a temporary compatibility layer created under the incorrect PRD v2.5 architecture. They are not the target architecture.

Transition order:

1. Apply and rehearse the additive Universal runtime migration.
2. Add the isolated artifact build/provisioning worker and app-scoped PostgreSQL credential injection.
3. Submit, review, build, and deploy the Simpleshop artifact from the Simpleshop repo.
4. Run identity, two-Organization database isolation, private image/PDF, desktop/mobile, health, and rollback acceptance.
5. Switch `/app/simpleshop` to the Universal launcher.
6. Migrate any real compatibility-table data if it exists.
7. Remove hardcoded Simpleshop code/tables only through a reviewed, recoverable migration.

Do not delete the compatibility layer before step 5, and do not allow both runtimes to accept writes at the same time. Production currently has no retained Simpleshop business records from QA, but the cutover still follows the same guarded process.

## Current verification and remaining work

Implemented on the Universal branch:

- strict manifest and agent release validation;
- generic launcher, one-time exchange, introspection, capability grants, and private asset routes;
- platform-only Prisma schema and transaction-wrapped migration;
- additive compatibility strategy with no destructive production change.

Still required before calling the migration complete:

- non-production SQL rehearsal and then approved production migration;
- isolated build/deployment worker and database provisioning/injection;
- independent Simpleshop release registration and runtime deployment;
- end-to-end cutover acceptance;
- removal of the old AppAI business implementation after rollback criteria pass.

Earlier Phase 1/2 monolith verification remains useful only as evidence that the compatibility layer is stable. It must not be treated as the final Universal architecture.
