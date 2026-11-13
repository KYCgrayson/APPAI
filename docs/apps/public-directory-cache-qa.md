# Public directory cache QA — #92-A

The homepage, shared tools/apps/websites directory, and App detail/metadata now
use `src/lib/public-directory.ts`. All three cache families use
`unstable_cache`, `public-directory`, and `revalidate: 3600`. Directory keys
include locale, kind, category, personal filter and batch offset. Home keys
include locale; detail keys include id and locale. Each directory batch selects
50 Apps, then caches only display DTOs. Classification happens before caching,
so complete HostedPage content and raw Date-bearing models never enter these
entries. The rendered fields need no dates, preserving HTML and JSON-LD through
the cache's JSON round trip. The existing full directory view remains intact.

## Invalidation audit

| Writer | Invalidation after successful commit |
| --- | --- |
| Page API writes, including approval policy changes | Existing `withPageWrite` / `page-write-guard` |
| Dashboard unpublish/delete/restore | Existing `revalidateSeoIndexes("all")`; dry runs do not invalidate |
| App POST/PUT | Existing `withPageWrite` |
| App DELETE | Existing `revalidateSeoIndexes()` |
| Release POST | Added after the release/App transaction commits |
| Managed runtime activation | Added in the database adapter, after transaction commit; the pure transaction service stays independent |
| Admin approve/unapprove/feature/unfeature and DELETE | Added after successful App write |
| `hosted-page-approval.ts` | Pure policy, no writes; all five calling page API files already use `withPageWrite` |

`revalidateSeoIndexes` calls `revalidateTag(tag, { expire: 0 })` separately for
both tags. A sitemap failure does not prevent directory expiry. Tests exercise
all four admin actions, deletion, unsuccessful writes, warmed-cache removal,
metadata/404 behavior, key separation, 121 listings across three batches, a
HostedPage content field exceeding 2 MB, and cold/hot HTML/JSON-LD rendering.

## Reproduce with fictional data

No database is needed. The mock preload refuses to load without explicit
opt-in and the exact unreachable mock URL. Never substitute an actual URL.
Node dependencies must be installed (`npm ci`). These commands do not alter
hosting settings or schema.

```sh
export DIRECTORY_CACHE_QA=1
export DATABASE_URL=postgresql://mock:mock@127.0.0.1:1/mock
export AUTH_SECRET=local-fictional-cache-verification
export AUTH_TRUST_HOST=true
export DIRECTORY_QUERY_LOG=/tmp/appai-directory-queries.jsonl
export DIRECTORY_QA_OUTPUT=/tmp/appai-directory-qa
export NODE_OPTIONS="--require $PWD/tests/helpers/public-directory-production.cjs"
npm run build -- --webpack
# Move any previous generated .next/cache/fetch-cache aside before a cold run.
NODE_ENV=production node scripts/qa-public-directory-cache.cjs
```

The harness invokes the real production Next request handler with mocked HTTP
streams and the real Next data cache. It records every public data delegate read
as JSONL, sends 20 independent anonymous requests per route, saves the initial
HTML, and asserts zero reads after the first request. It then calls the real
admin PATCH route using a fictional admin session and checks the very next
home en/zh-TW, apps and detail responses. This is not a mock of `unstable_cache`.
It does not count SQL or test a real PostgreSQL connection.

For the requested actual listening-server check in a suitable environment:

```sh
NODE_ENV=production npm start -- --hostname 127.0.0.1 --port 3192
# In another shell, with a cold cache and no cookies:
for n in $(seq 1 20); do curl -fsS http://127.0.0.1:3192/ > /dev/null; done
```

Use the same preload and log variables in the server shell. Inspect the JSONL
log for first-request reads only. Repeat with a cold cache for the other routes.
Capture homepage en, zh-TW and `/apps` before/after using the same fictional data,
viewport and browser. Do not run the fixture admin cookie against another server.

## Evidence from this implementation

The production handler returned HTTP 200 for all 120 anonymous requests:

| Route | Requests | Reads on first request | Reads on requests 2–20 |
| --- | ---: | ---: | ---: |
| `/` | 20 | 5 | 0 |
| `/zh-TW` | 20 | 5 | 0 |
| `/apps` | 20 | 5 | 0 |
| `/tools` | 20 | 5 | 0 |
| `/websites` | 20 | 5 | 0 |
| `/apps/fixture-native` | 20 | 8 | 0 |

Checks: `npm run build -- --webpack` passed; `npm test` passed 670 tests
(4 existing opt-in tests skipped, 0 failures); `npm run lint` passed with 32
warnings and no errors. `npm run feature-map:check` passed with all 723 tracked
files covered using a temporary staged index. The actual worktree index is
outside the sandbox's writable roots, so `git add`/commit could not be completed.

The first detail request includes parallel metadata/body cache misses. The
following requests reuse the same entry. Admin unapprove returned 200; the very
next home en/zh-TW, apps and detail responses hid the listing immediately.

A separate build of the original commit used the same fictional rows. Comparing
every body element, attribute and text node (excluding scripts/styles/comments)
against the changed production build produced identical DOMs: home en 741
tokens, home zh-TW 747 tokens, apps 269 tokens.

Verification limitations: default Turbopack `npm run build` and `next start`
failed because this sandbox denies local port binding (`EPERM`).
`npm run build -- --webpack` passed. Direct Chrome launch was also blocked;
the connected browser's automatic approval review rejected local `file://`
snapshot navigation because its URL policy permits only HTTP/HTTPS. No screenshot
comparison or actual listening HTTP run was completed. DOM equality supports
render parity but cannot establish pixel/layout parity. The referenced
`runs/2026-11-13-appai-neon-compute.md` was absent from this checkout; the supplied
brief supplied the scope. No production database or Neon/Vercel configuration
was accessed.
