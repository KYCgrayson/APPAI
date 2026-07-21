# Simpleshop Universal App integration

| Item | Adopted value |
|---|---|
| Product source of truth | `Simpleshop/simpleshop-PRD.md` |
| Product specification | Simpleshop PRD v2.6 |
| Adopted Simpleshop commit | `94ee18e` |
| Platform specification | Universal App platform changes v2.0 |
| App id | `simpleshop` |
| Public entry | `/app/simpleshop` → platform-managed `https://simpleshop.appai.info` |
| App manifest | `Simpleshop/appai.app.json` |
| Current state | Independent runtime and first customer/job-site slice implemented; platform migration in progress |

The complete product PRD stays in the Simpleshop repository. This document records the platform integration.

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
| `POST /api/v1/apps/simpleshop/releases` | Agent API key | Submit a strict versioned manifest; receipt remains `PENDING` awaiting platform review |
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

The transaction-wrapped migration is `prisma/universal-app-runtime-migration.sql`. Historical business tables remain retained but are not used by AppAI runtime code.

## Independent Simpleshop runtime

The Simpleshop repository now contains:

- a standalone Next.js app that builds without importing AppAI code;
- a strict `appai.app.json`;
- AppAI launch-code callback and session introspection client;
- app-owned Prisma schema and initial migration;
- Organization-scoped customer and job-site CRUD plus a working management UI;
- validation tests proving browser input cannot inject `organizationId` or permanent customer codes.

## Universal launch

`/app/simpleshop` and nested bookmarks such as `/app/simpleshop/items` use the generic Universal launcher. After AppAI login, the launcher supplies a one-time identity handoff to the platform-managed `https://simpleshop.appai.info` runtime. The app remains an isolated deployment, but it is visibly hosted on the AppAI subdomain rather than an app-supplied domain. An approved `ACTIVE` production deployment is required; otherwise AppAI fails closed and does not serve a compatibility UI. Verify identity, two-Organization database isolation, private assets, health, and runtime acceptance against the independent application.

Release and cutover evidence must satisfy the shared [Universal App Runtime QA gates](universal-app-runtime-qa.md). Simpleshop business acceptance remains in the Simpleshop repo; the shared checklist covers platform/runtime boundaries.

An external agent submits only the credential-free public GitHub repository URL
in `https://github.com/{owner}/{repo}` form, exact commit,
manifest, and release metadata. It never supplies a runtime URL, database
credentials, provider credentials, raw SQL, or infrastructure settings. An
AppAI administrator reviews the `PENDING` release and starts the generic
validation, build, database, migration, deployment, health, and activation
pipeline; the agent polls the release status rather than controlling that work.
Like every Universal App, Simpleshop's `package.json` must define `test` and
`typecheck` scripts; both scripts and the declared build command must pass
before the managed pipeline can deploy it.

## Current verification and remaining work

Implemented on the Universal branch:

- strict manifest and agent release validation;
- generic launcher, one-time exchange, introspection, capability grants, and private asset routes;
- platform-only Prisma schema and transaction-wrapped migration;
- Universal runtime additive migration rehearsed with rollback, applied on 2026-07-19, and verified with an empty post-apply schema diff;
- isolated Simpleshop test database verified with separate migration/runtime roles; the runtime role can perform business CRUD but cannot perform DDL;
- historical business tables retained without destructive production change.
- `/app/simpleshop` fails closed for a missing, suspended, unapproved, or inactive release; no compatibility runtime exists.

Still required before calling the migration complete:

- isolated build/deployment worker and database provisioning/injection;
- independent Simpleshop release registration and runtime deployment;
- end-to-end cutover acceptance;
