# APPAI ops #67 — SEO re-check implementation

2026-11-18, Asia/Taipei. Worktree branch `claude/67-seo-recheck`, base `3ddf782`. Implementation: Codex (GPT-6); independent review: a separate Codex agent, given the audit and acceptance scope, without the implementation conversation. No commit, push, PR, deployment, DB connection/write, package installation or game-logic change. `.seo-live/` was read only.

F1–F9 implemented. F10–F12 and package C remain outside this change. These are local proposed outputs; production has not changed.

| Finding | Change (files) | Acceptance evidence |
| --- | --- | --- |
| F1 | `src/lib/sitemap-entries.ts`, `sitemap-data.ts`, `spec-topics.ts`; `src/app/spec/[topic]/route.ts`: each platform locale gets a loc, approved self-canonical bound apps are included, shared allowlist covers `/spec` + 10 topics, external marketing does not suppress local policies. | `tests/seo-recheck.test.ts`: 99 platform locs + 11 spec URLs on empty fixture; nine-locale reciprocal clusters; bound app; real spec handlers; external-marketing/local-policy metadata and route resolution. `sitemap*.test.ts`: shard/cache/XML bounds. Existing single-locale tests retain child/policy/converted-alias checks. |
| F2 | `sitemap-entries.ts`, `sitemap-data.ts`: maintained 2026-11-18 date, related public App/root timestamps by actual directory membership. Home omits lastmod because its live count has no reliable change timestamp. Unknown spec dates omitted. | Relevant website/tool fixtures, draft exclusion, stable repeated output and invalid-date omission. Independent reviewer reproduced that editing an existing child does not change homepage content/date. No request-time dates. |
| F3 | `games-catalog.ts`, `games-pages-copy.ts`, `tabletop-puzzles-copy.ts`: EN/繁中/简中 hub and six existing detail/collection scenes; no-prep, interruptible 10–15 minute waits; Werewolf reserved for conversation. | Actual rendered FAQ/FAQPage equality; specific game titles/H1 and facts retained; six other locales’ game body/JSON-LD byte comparisons. Existing Night Bridge fire-story tests pass. |
| F4 | `hosted-page-seo.ts`, hosted `page.tsx`, `page-preview.ts`: shared description resolver, public visible summary fields only, nonblocking missing-description warning. | Authored bytes/priority, blank input, login/admin gates, non-rendered fields/cards excluded, Markdown/whitespace/Unicode truncation; actual root/child HTML/OG/Twitter/primary JSON-LD agreement; preview behavior. |
| F5 | `directory-copy.ts`: complete short ja/ko/de/fr/es/hi UI. Shared category navigation and personal-app breadcrumb label also translate where rendered. | Real home and directory renders, all fields nonblank, publisher fallback retained; metadata stays unchanged. Historical header comparisons allow only these exact translated strings. |
| F6 | `next.config.ts`: three exact raw index.html X-Robots-Tag rules. | Loaded config returns precisely three noindex/follow rules; all previous headers and play rewrites compare byte-for-byte. Existing game compatibility tests cover query/hash routes. Deployed headers await production check. |
| F7 | locale logout metadata, device server `layout.tsx`, `robots.ts`: noindex/follow on auth shells, remove broad `/auth/` crawl block; API remains blocked. | Real server metadata exports and robots route checked against all locale URLs; auth actions unchanged. |
| F8 | `scripts/generate-game-social-images.mjs`, six `public/games/covers/*.png`, `games-page-seo.ts`: raster OG/Twitter with 1200×630 dimensions; SVG UI/schema covers unchanged. | All six file signatures/dimensions; byte-exact offline regeneration with installed sharp; all 54 locale/page social URLs; original SVG bytes equal base. |
| F9 | hosted SEO and locale app-detail `page.tsx`: omit unsourced third-party free Offers. | Actual public app renders across all locales and hosted download schemas; exact remaining metadata/schema comparison. Own free game/platform declarations untouched. |

External agent contract updates: `docs/spec/api.md`, `pages.md`, `i18n.md`, `games.md`, `src/app/llms.txt/route.ts`, regenerated `AGENT_INSTRUCTIONS.md`. Feature maps and existing regression expectations are updated in the same change. No API/pricing schema field was introduced.

## Exact output changes

[Complete before → after inventory](seo-recheck-67-output-diff.md) includes every changed game metadata/intro/FAQ string, six-locale directory UI strings, social URL/dimensions, hosted descriptions, unknown-price schema, auth/raw indexing, sitemap and agent-discovery outputs. Dynamic hosted/app URL sets are specified by eligibility rule because no production DB was queried. `/p/graysonviews` is the supplied live snapshot’s confirmed missing-description case.

Untargeted safeguards compare actual output against `3ddf782`: hosted root/child/legal metadata and body/JSON-LD across nine locales and four templates; game body/JSON-LD in the six unchanged content locales; public app metadata in all locales. Existing hosted historical HTML hashes stay unchanged. Only the explicitly changed sitemap and llms hashes are repinned.

## Commands and review

| Command | Result |
| --- | --- |
| `node scripts/generate-game-social-images.mjs` | PASS — six 1200×630 PNGs, existing sharp; no new dependency |
| `npm run spec:build` | PASS — generated spec synchronized |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 866 total, 854 passed, 12 optional/integration skips, 0 failures |
| `npm run lint` | PASS — 0 errors, 31 existing warnings |
| `npm run feature-map:check` | PASS — 19 features, 690 mapped + 100 ignored files; temporary index includes all new files, real index unchanged |
| `git diff --check` | PASS |

Independent review passed: 43 relevant tests, then 17/17 after the homepage-date fix. Logs: `/private/tmp/appai-seo-independent-review.tap`, `/private/tmp/appai-seo-independent-final.tap`. Full checks: `/tmp/seo67-{spec,typecheck,tests,lint}.log`.

The standalone spec route allowlist was moved to a shared module; old source-text tests were updated to read the shared list, and new tests exercise every real handler response. Existing preview tests about styles/headings now provide an explicit description, while dedicated F4 tests cover the newly added warning. Other historical assertions permit only F1/F2/F5/F8/F9’s intended deltas.

## Unverified / handoff

- Production GET recheck is unavailable here: `curl --connect-timeout 10 --max-time 15 https://appai.info/sitemap.xml` returned `curl: (6) Could not resolve host: appai.info`. After an owner-approved deployment, fetch every sitemap shard; verify representative hosted child/policy/converted Chinese URLs and all nine locale canonical clusters; verify raw-index and auth noindex responses. Fixtures cannot establish production HTTP status or crawler behavior.
- Before/after browser screenshots were attempted using the repo’s existing headless Chrome helper. Chrome exited during startup (`Chrome exited null`), before capture. No screenshots or visual-browser pass claimed. Rendered HTML and exact social-raster tests passed; a sample raster was visually inspected.
- The 12 optional tests include browser, production-cache harness and disposable-Postgres integration checks; no real DB was used.
- No ops inbox/run file, pull/rebase, commit or push: ops is outside the sandbox’s writable roots, and this task explicitly requires leaving changes uncommitted and not pushing. This report is the local handoff; the owner can copy it to ops. 
- F10/F11/F12, new games, gameplay, external-game hosting/package C, database/pricing fields and publisher content edits were not done, as requested.

## Ops inbox line to copy

`- 2026-11-18 13:53｜APPAI｜67｜SEO F1–F9 已實作，離線檢查與獨立審查通過；未提交／未推送；正式 GET 與瀏覽器截圖待可用環境驗證｜claude/67-seo-recheck；docs/apps/seo-recheck-67.md`

## Round 2 — 2026-11-18

Base `58fd72d`, same branch. This section supersedes round 1's directory classification and individual-puzzle FAQ behavior. Implemented by Codex (GPT-6). No DB/production access, network install, commit, push or PR. `.seo-live/` was not read or changed in round 2.

| Request | Result |
| --- | --- |
| Neon compute | Chose the cheaper shared-directory-date option: no content/classification query. All three directories use the max of the maintained platform date, approved App timestamps and their same-organization published bound roots. This is deliberately conservative across directory kinds. Unbound roots do not affect these dates. |
| Shard validation | Syntax/safe-integer check, then cached `loadSitemapIds()`, then `loadSitemapShard()` only for an existing ID. Out-of-range: 404, no page-data load or new shard cache key when IDs are warm. |
| Direct dependencies | `unified: 11.0.5`, `remark-parse: 11.0.0` exactly match installed and already locked package records. Updated root dependency declarations in both manifests by hand; zero network/install required. |
| Hero description | Plain-text whitespace/truncation only; Markdown parsing is limited to markdown-capable intro fields. Literal punctuation, links and entities are preserved in hero text. |
| App lastmod | Per locale, max of App and `pickByLocale()` bound published root variant, scoped by organization; standalone apps retain their timestamp. No extra query and no platform-date floor on app details. |
| FAQ | English “may not be enough”; repeated 10–15-minute FAQ retained on hub/collection and removed from the three individual puzzles. Six other locales did not contain that duplicate. All nine locales have rendered FAQ/JSON-LD parity coverage. |
| Raw game URLs | Three raw slugs derived from `OWN_GAME_SLUGS` filtered by catalog `buildSlug`, unchanged headers/rewrites. |
| Image utility | Uses `fileURLToPath(output)`. |
| Directory copy | Six locale objects reformatted to match en/zh; text unchanged. |

### Exact sitemap queries after round 2

Every `loadSitemapEntries()` call performs these **three Prisma queries**. Query 1 runs first; queries 2 and 3 run in parallel. No content query is performed.

```ts
const roots = await db.hostedPage.findMany({
  where: publicPageWhere(), // { isPublished: true, parentSlug: null }
  select: {
    organizationId: true, slug: true, parentSlug: true,
    isPublished: true, locale: true, isDefault: true, updatedAt: true,
  },
  orderBy: [{ slug: "asc" }, { locale: "asc" }],
});
const [pages, apps] = await Promise.all([
  db.hostedPage.findMany({
    where: publicPageWhere(roots),
    select: {
      slug: true, parentSlug: true, organizationId: true, locale: true,
      isDefault: true, updatedAt: true, privacyPolicy: true,
      termsOfService: true, canonicalUrl: true,
    },
    orderBy: [{ slug: "asc" }, { locale: "asc" }],
  }),
  db.app.findMany({
    where: publicAppFilter(roots),
    select: { id: true, updatedAt: true, hostedPageSlug: true, organizationId: true },
    orderBy: { id: "asc" },
  }),
]);
```

The unchanged predicates are defined in `src/lib/hosted-page-visibility.ts`:

- `publicPageWhere(roots)`: `isPublished: true`, and either a root (`parentSlug: null`) or a child matching a published root's organization and slug, with `isDefault: true` or an exact/Chinese-source-compatible root locale.
- `publicAppFilter(roots)`: `isApproved: true`, and either `hostedPageSlug: null`, `hostedPageSlug: ""`, or a binding whose organization and slug match a published root.

Both ID and shard caches retain `revalidate: 3600`, tag `seo-sitemap`. Warm IDs + invalid shard: **0 DB queries**. Cold IDs + invalid shard: **3 queries to populate the ID cache**, no shard-data query/cache entry. Cold IDs + cold valid shard: **6 queries** (existing separate caches); warm IDs + cold valid shard: **3**; both warm: **0**. No production SQL was executed or captured.

### Round 2 verification and handoff

- `spec:build`, `typecheck`, `lint`, `feature-map:check`: PASS; lint has 0 errors and 31 existing warnings.
- `npm test`: PASS, 867 tests, 855 passed, 12 opt-in/integration skips, 0 failures. Database environment variables explicitly unset for the run.
- Regression evidence covers no-content/minimal query projections, three-query load budget, invalid shard cache keys/data reads, organization/locale lastmod and literal hero text. Independent Codex review found no functional blockers; its two requested test improvements (query-budget assertions and observable newer-default fallback) were added and independently rechecked as resolved. Final full suite passed after these changes.
- Dependency manifest/lock/installed-version consistency: PASS. No install command needed.
- Screenshot attempt: existing headless Chrome helper exited during startup (`Chrome exited null`); no screenshots or browser visual pass claimed. Actual rendered HTML/FAQ/schema checks pass in all nine locales.
- Logs: `/private/tmp/appai-67-round2-{spec,typecheck,test,lint,feature-map,targeted}.log`.
- Spec impact: internal query/metadata corrections and FAQ deduplication; no new external-agent capability or payload contract, so no additional spec fields required. `spec:build` produces no diff.
- Ops inbox/run writes are unavailable because ops is outside the writable sandbox. No pull/rebase/commit/push was attempted, honoring this task's explicit uncommitted/no-push requirement. This local report is the run/handoff record.

Ops inbox line to copy:

`- 2026-11-18 14:02｜APPAI｜67｜SEO round 2 修正；三個 sitemap 查詢不讀 content、shard 越界 404、依賴與各 nit 完成；指定檢查通過；未提交／未推送｜claude/67-seo-recheck @ 58fd72d；docs/apps/seo-recheck-67.md`
