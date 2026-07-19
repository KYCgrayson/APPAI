# Universal App Runtime QA Gates

This checklist is the release contract for any agent-built app hosted by AppAI. App-specific business tests stay in the app repo; AppAI owns the generic runtime, identity, capability, deployment, and rollback gates.

## Responsibility model

| Role | Responsibility |
|---|---|
| Orchestrator | Freeze scope, assign implementation, review diffs, sequence the two repos, and decide whether a gate passes. |
| Implementation agent | Change only the assigned repo/slice, add focused tests, and return the exact files and commands touched. |
| QA verifier | Re-run tests independently, inspect negative paths, record sanitized evidence, and reject agent self-reported success when evidence is missing. |

Implementation completion is not release completion. A release is eligible for cutover only after every required gate below has independent evidence.

## Gate sequence

| Gate | Required verification | Pass evidence | Stop condition |
|---|---|---|---|
| G0 — Source control | Confirm intended branch, remote divergence, and exact dirty files in both repos. Preserve unrelated work. | Branch/status/diff summary for each repo. | Unknown or overlapping local changes. |
| G1 — Artifact | Validate manifest; install from lockfile; run unit tests, typecheck, production build, and dependency audit in the app repo. | Commands exit 0; build contains health, callback, and app routes; no high/critical audit findings. | Manifest mismatch, generated-file drift, test/type/build failure, or unsafe dependency. |
| G2 — Database | Review app-owned migration; rehearse transaction with rollback; apply using migration role; verify schema diff; test runtime role CRUD and DDL denial. | Rehearsal and apply exit 0; post-apply diff empty; runtime CRUD succeeds and CREATE/ALTER/DROP fails. | Runtime credential has migration, platform DB, or cross-app access. |
| G3 — Identity/session | Launch requires AppAI login and Organization; exchange one-time code; introspect audience/capabilities; replay, expiry, revocation, wrong app, and suspension fail. | First exchange succeeds; replay and invalid audience are rejected; introspection exposes only scoped identifiers/grants. | Browser can choose identity/Organization, token can be replayed, or suspension is bypassed. |
| G4 — Tenant isolation | Test with two Organizations; reject body/query `organizationId`; scope list/detail/create/update/delete and related IDs. | Forged Organization input is 400; cross-Organization IDs are 404/denied; each Organization sees only its own records. | Any unscoped query, relation, uniqueness check, or asset lookup. |
| G5 — Private assets | Upload allowed image/PDF types; verify magic bytes, size/quota, opaque ID, authenticated read/delete, and cross-Organization denial. | Owner can round-trip; unauthorized and other-Organization access are denied; no permanent private URL is returned. | Public object URL, MIME-only validation, or cross-scope read/delete. |
| G6 — Runtime UX | Test login-to-launch, callback, refresh, API errors, and core CRUD on desktop and mobile viewport. | Screenshots or test log for both viewports and a sanitized CRUD transcript. | Login loop, broken callback/return path, uncaught error, or unusable mobile flow. |
| G7 — Cutover/rollback | With no production deployment, compatibility remains available. With approved + active production deployment, launcher redirects. Invalid release, inactive deployment, or suspended instance fails closed. Roll back to the last healthy immutable release. | State matrix passes and rollback restores health without writing to both schemas. | Split-brain writes, catch-all fallback, destructive migration, or rollback requires source edits. |
| G8 — Release hygiene | Verify migration status, runtime health, deployment/release IDs, capability grants, sanitized logs, clean repo, commit, push, and PR checks. | Both PRs point to reviewed commits; required checks pass; no secrets or test data remain. | Dirty worktree, missing evidence, live test residue, secret exposure, or failing remote check. |

## Current repo commands

Run these from the respective repository roots. Environment-specific integration tests must use disposable data and minimum-privilege test credentials; never print credentials or production data.

### AppAI platform

```bash
npx prisma validate
npm test
npm run typecheck
npm run build
npm audit --audit-level=high
```

### App artifact

```bash
npx prisma validate
npm test
npm run typecheck
npm run build
npm audit --audit-level=high
```

## Cutover state matrix

| Universal state | `/app/{appId}` behavior |
|---|---|
| No release | Compatibility may remain during migration. |
| Approved release, no production deployment | Compatibility may remain while provisioning is incomplete. |
| Approved release + active production deployment | Issue one-time launch code and redirect to the isolated runtime. |
| Non-approved release with no valid active candidate | Fail closed; do not enter compatibility as a bypass. |
| Existing non-active production deployment with no valid active candidate | Fail closed; do not enter compatibility as a bypass. |
| Suspended Organization app | Fail closed and issue no launch code. |

If multiple releases exist, a valid approved + active production candidate wins. New draft work must not disable the last healthy deployment.

## Evidence record

For every release candidate, record:

```text
AppAI commit:
App commit:
Manifest version and digest:
Database migration rehearsal/apply/diff:
Runtime-role permission test:
Identity exchange/replay/introspection:
Two-Organization isolation:
Private-assets round trip:
Desktop/mobile run:
Health URL and checked time:
Rollback target and result:
Open risks or skipped gates:
```

Skipped gates are failures unless the orchestrator explicitly marks them as non-applicable with a reason. Never label a release complete from an implementation agent's report alone.
