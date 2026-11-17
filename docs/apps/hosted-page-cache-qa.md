# Hosted-page data cache QA — #92-B

Implemented against `89e872d` on 2026-11-17. Route 2 keeps `/p` dynamically
rendered; only public publisher data is shared. This establishes **zero DB reads
on warmed cookie-free anonymous GETs**, not zero DB activity from a browser:
anonymous PageView beacons still write, and iframe renewal still reads as before.
Oversized entries are an explicit exception to the zero-read guarantee.

## Data and invalidation contract

| Family | Key arguments | Cached data |
| --- | --- | --- |
| root | slug, explicit locale or null | Selected public render DTO or null |
| child | organization ID, parent slug, child slug, explicit locale or null | Public child DTO or null; parent visibility checked on miss |
| root variants | slug, organization ID or null | URL/chrome summaries; null organization preserves Accept-Language query scope |
| child variants | organization ID, parent slug, child slug | Visible URL/chrome summaries |
| siblings | organization ID, parent slug, effective locale | Navigation rows, with ISO createdAt |
| membership | organization ID, root slug | kind/personal flags or null |

Each versioned entry contains one DTO and its load timestamp. All families use
`unstable_cache`, tag `hosted-page`, and `revalidate: 86400`. Null and empty results
are cached. No nested persistent caches; `React.cache` deduplicates within a
render. Public page Dates cross as ISO and return as Date objects. Full render
DTOs explicitly project an allowlist; summaries use Prisma selects. Session,
viewer, token, organization records, removal audit and unused private columns
are excluded. Publisher content, including published contact information and
simple-order settings, keeps its existing server-side handling.

The guard counts UTF-8 bytes of Next's fetch envelope, including the second
escaping of its JSON body. Above **1,800,000 bytes**, the callback throws before
Next can write it. The wrapper returns that request's already-read DTO and logs
only the public slug/key, family and byte count. No chunks or bypass markers are
persisted. The error keeps the DTO in a private field so Next's background-error
logging cannot print its content. When Next returns a TTL-stale entry, the outer
wrapper reads fresh data; thus a too-large background refresh cannot leave the
old page visible indefinitely. This once-daily fallback may overlap Next's
background DB read. Actual DB errors propagate instead of becoming cached 404s.

`revalidateSeoIndexes()` now always calls
`revalidateTag("hosted-page", { expire: 0 })`, even without a slug. Existing
`seo-sitemap`, `public-directory`, discovery paths and conditional hosted layout
revalidation remain intact. All existing page/API/dashboard/admin/release/
activation writers retain their commit-before-invalidate wiring. Unapproving
an App keeps its `/p` content public and removes its category breadcrumb and
matching JSON-LD on the next request.

Server `auth()`, section access decisions, account chrome, token signing and
Accept-Language redirects run per request. The root layout and shared not-found
boundary obtain public data through the resolver; neither needs a UI change.

## Reproduction and isolation

Use an isolated copy of tracked source plus the new files, excluding **every
`.env*` file**, with existing node_modules available. The test preload refuses
any database URL except the unreachable fixture URL below. No database,
credentials, hosting configuration or paid service is needed. Start with a fresh
`.next/cache/fetch-cache` for reproducible stored-entry counts.

```sh
# Run in that isolated copy, with an otherwise clean environment.
export HOSTED_CACHE_QA=1
export DATABASE_URL=postgresql://mock:mock@127.0.0.1:1/mock
export AUTH_SECRET=local-fictional-cache-verification
export NEXTAUTH_SECRET=local-fictional-cache-verification
export AUTH_TRUST_HOST=true
export HOSTED_QUERY_LOG=/tmp/appai-hosted-queries.jsonl
export HOSTED_QA_OUTPUT=/tmp/appai-hosted-qa
export NODE_OPTIONS="--require $PWD/tests/helpers/hosted-page-production.cjs"
npm run build -- --webpack
NODE_ENV=production node scripts/qa-hosted-page-cache.cjs
```

The harness uses the actual production `next({dev:false})` request handler,
actual Data Cache and Auth.js Prisma adapter. Only HTTP streams and Prisma rows
are fictional. It logs every delegate operation, including session/user,
raw reads/writes and transaction boundaries; unexpected delegates/operations
fail closed. Counts are delegate calls, **not SQL queries**. The trusted hosted
path header normally set by middleware is supplied by the harness. A real
no-content-change admin mutation expires all families before each 20-request
case, preventing previous cases from prewarming its public reads. Mutations
use real route handlers, never direct fixture edits to simulate publication.

For baseline captures, build `git archive 89e872d` in another isolated directory
with the same fixture/runner and environment, then run with
`HOSTED_QA_BASELINE=1` and a separate output directory. Compare:

```sh
python3 scripts/compare-hosted-page-dom.py /tmp/appai-hosted-before /tmp/appai-hosted-qa
```

Run #92-A's original `qa-public-directory-cache.cjs` separately using its own
preload/environment and a fresh fetch cache; do not combine the two preloads.

## Production-handler evidence

All 300 anonymous requests passed. Every value in each route's requests 2–20
read vector is zero; session/user are included. GET writes were also zero.
All success cases returned 200 and missing-resource cases returned 404.

| Route case | Requests | First GET reads | Reads on GETs 2–20 |
| --- | ---: | ---: | ---: |
| PERSON `/p/fixture-person` | 20 | 6 | 0 |
| root `/p/fixture-app` | 20 | 6 | 0 |
| child `/p/fixture-app/fixture-child` | 20 | 10 | 0 |
| explicit locale `/p/fixture-app/zh-TW` | 20 | 6 | 0 |
| Chinese fallback `/p/fixture-app/zh-CN` | 20 | 7 | 0 |
| inline iframe `/p/fixture-tool` | 20 | 6 | 0 |
| fullscreen iframe `/p/fixture-tool/tools/0` | 20 | 3 | 0 |
| LoginGate `/p/fixture-login` | 20 | 6 | 0 |
| fullscreen LoginGate `/p/fixture-login/tools/0` | 20 | 3 | 0 |
| unknown slug | 20 | 1 | 0 |
| missing child | 20 | 10 | 0 |
| missing locale | 20 | 4 | 0 |
| missing policy | 20 | 6 | 0 |
| privacy | 20 | 6 | 0 |
| terms | 20 | 6 | 0 |

11 actual mutation responses and 20 immediate-next-GET checks passed; each
subsequent warm GET had zero reads. Dashboard scope confirmation uses the real
dry-run handler before the real mutation.

| Mutation | Response | Very next GET result |
| --- | ---: | --- |
| Page PUT | 200 | Updated title and metadata |
| Child PATCH | 200 | Updated parent navigation and child content |
| Page unpublish | 200 | Explicit locale returns 404 |
| Page publish | 200 | Public root restored |
| Dashboard unpublish | 200 | Root, child and privacy return 404 |
| Dashboard restore | 200 | Root, child and privacy return 200 |
| Dashboard delete | 200 | Root, child and privacy return 404 |
| Dashboard restore after delete | 200 | Previous publication restored, including child |
| POST root after cached 404 | 201 | New root returns 200 |
| POST child after cached 404 | 201 | New child returns 200 |
| Admin unapprove | 200 | Page stays 200; category link and JSON-LD category removed |

21 alternating requests cover anonymous → User A → anonymous → User B → Admin
→ anonymous → invalid cookie on inline gated, fullscreen gated and public iframe
pages. Real Auth.js resolves each session. Header names match the current user;
LoginGate passes only for signed-in viewers; identity subjects match A/B/Admin,
are null for anonymous public tools, and are absent behind anonymous gates.
Audience and token expiry ordering are checked. Anonymous reads remain zero;
valid sessions perform 4 reads inline/2 fullscreen, invalid cookies 2/1. These
auth reads intentionally remain uncached. Anonymous `/api/auth/session` has zero
reads. Accept-Language gives 307 to zh-TW; an explicit locale preference gives
200 with English html lang.

The 1,811,054-byte synthetic large page bypasses root caching: its two GETs
read 6 then 1 delegates; both return the complete page and warn. All 38 persisted hosted
entries were inspected: maximum 1,132 bytes, with no viewer/session/token/audit data.
Unit fixtures additionally cover oversized policy, CSS, a single section,
Chinese/emoji, and escape-heavy JSON that would exceed Next's envelope limit
while its first serialization is below 1.8 MB. A regression using the installed
Next implementation exercises stale small→large, background rejection without
payload logging, DB failure propagation and recovery to a small cached value.

## DOM and JSON-LD parity against main

Both cold and hot captures match main for all ten cases.
Each comparison preserves every publisher element, attribute and text node,
html lang/dir, metadata, canonical/hreflang and parsed JSON-LD. It excludes
executable scripts/build resource links, normalizes transient iframe tokens,
and excludes generated encrypted `$ACTION_*` hidden transport inputs. It does
not remove publisher content, visible login forms or breadcrumbs. No pixel
parity is claimed.

| Case | Compared tokens | JSON-LD blocks | html lang | Result |
| --- | ---: | ---: | --- | --- |
| PERSON | 156 | 2 | en | Identical |
| App root | 159 | 2 | en | Identical |
| App explicit locale | 156 | 2 | zh-TW | Identical |
| App Chinese fallback | 160 | 2 | zh-CN | Identical |
| Inline iframe | 149 | 2 | en | Identical |
| Fullscreen iframe | 85 | 2 | en | Identical |
| Child | 172 | 2 | en | Identical |
| Privacy | 176 | 2 | en | Identical |
| Terms | 176 | 2 | en | Identical |
| LoginGate | 158 | 2 | en | Identical |

## Checks and remaining limits

| Check | Result |
| --- | --- |
| `npm run build -- --webpack` | Passed using only mock env in an isolated source copy |
| `npm test` | 785 total: 777 passed, 8 existing opt-in skips, 0 failed |
| `npm run lint` | 0 errors, 31 warnings |
| `npx tsc --noEmit` | Passed |
| `npm run feature-map:check` | Passed: 19 features; 669 mapped, 94 ignored, 763 files |
| Supplemental independent Codex review | Found TTL oversized-stale edge; fixed and independently rechecked, 30/30 focused tests |

The feature-map check used a temporary index/object directory including new files;
the real worktree index was unchanged. Machine-readable evidence is produced by
the harness as `production-evidence.json`, with complete per-request read vectors,
mutation results, auth results and serialized cache sizes. The original #92-A production harness also passes all 240
requests and its admin-unapprove checks.

- `next start --hostname 127.0.0.1 --port 3193` was attempted and failed with
  `listen EPERM`. Production-handler QA is not a listening HTTP test.
- Existing local Chrome launch exited before creating a target; no before/after
  screenshots or hydrated-browser test was completed.
- Existing writer tests cover additional API/approval/activation wiring; this
  production harness does not replay every release/activation, App-rebinding or
  concurrent fill/write race. No real PostgreSQL/SQL measurements were made.
- Supplementary independent Codex review is separate from the required
  owner-side Opus acceptance, which remains pending.
- No commit, merge, push, deployment, production data access, Neon/Vercel change
  or renewal/tracking behavior change was performed.
