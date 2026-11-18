# Hosted-page small fixes — ops #91 PR-4

Base: `548b0ea`, branch `claude/91-pr4-small-bugs`. Fictional in-memory data only; no database, migrations, production requests, push or PR. Implementation and independent review: Codex (GPT-6 family). This document records reproduction, verification and remaining limits.

> Sections 1–4 and the first verification table record round 1. The round 2 corrections and current results are recorded at the end.

## 1. Child hero background image

**Verdict: reproduced input/variant mismatch; no child-only rendering bug found.** The original page payload was not supplied, so its exact variant and remote image availability are not proven.

- `HeroSection.tsx:109` returns the minimal text/logo/CTA layout without using backgroundImage/backgroundVideo. `centered` renders the background image at line 155; `split` renders a native image at line 98. A centered backgroundVideo takes precedence over backgroundImage.
- Child `page.tsx` passes child content to the same PageRenderer. Sanitization retains HTTPS YouTube thumbnail URLs. `next.config.ts` permits `img-src ... https:`; hero uses native image/CSS, not Next Image, so no image-host allowlist applies.
- Fix: `src/lib/hero-media.ts`, called by `sanitizePageContent`, returns explicit indexed field warnings for ignored variant media, image/video precedence, common wrong field names, malformed URLs and non-HTTPS/non-root-relative media. All POST/upsert, PUT, merged PATCH and both dry-run endpoints use it. Registry and sections spec explain the rule. Existing rendering stays unchanged.

Reproduction (local fixture; no publication required):

1. On a child `/p/ocean/episode`, use `{ "type":"hero", "data": { "headline":"Thumbnail", "variant":"minimal", "backgroundImage":"https://i.ytimg.com/vi/fixture/maxresdefault.jpg" } }`.
2. Main ignores the image without explaining the variant mismatch. The updated API accepts the payload with a `warnings` entry identifying `content.sections[0].data.backgroundImage` (preview additionally annotates `(hero)`).
3. Switch variant to `centered`: emitted CSS contains the unchanged URL. Switch to `split`: an img has that src. Remove backgroundVideo if the centered image should be visible.
4. These checks prove the renderer uses the URL, not that the fictional remote image is downloadable. A real thumbnail can still be absent or deny hotlinking; preview does not fetch it.

## 2. Root logo displayed as a letter

**Verdict: platform bug in App detail and admin App list; #80 public directory/home fallbacks are already correct.**

- Main's `src/app/[locale]/apps/[id]/page.tsx:111` chooses image vs letter from App.logoUrl alone. `src/lib/public-directory.ts:194` loads page content for classification but did not project a display-logo fallback. An older App row with null logoUrl therefore loses a valid root content.logo on its detail page.
- `src/app/admin/apps/page.tsx:71` had the same App-only image/letter condition.
- Header/favicon also used truthy strings instead of the valid-candidate rule: an invalid headerLogo such as `#` could suppress valid content.logo on light pages. Those now reuse page-logo's valid-candidate selection. Dark headers retain primary-logo precedence.
- Fix: expose a separate displayLogoUrl for App detail, using the published, same-organization localized root; admin uses the same shared fallback with the default published root. Keep original App.logoUrl for metadata/JSON-LD. Public directory caching remains unstable_cache with the same tags, keys' arguments, one-hour TTL and invalidation policy; detail key version changes only for the added DTO field. Background heroImage still does not count as a directory/App logo.

Reproduction:

1. Fixture root slug `ocean`: content.logo = `/logo.svg` (repeat with `https://example.com/logo.svg`); associated App `ocean-app`: logoUrl = null.
2. Render `/p/ocean`, `/p/ocean/episode`, the homepage/directory, `/apps/ocean-app` and admin App list. Main's detail/admin show a letter; the fix shows the root logo. Headers, root favicon and #80 directory/home already retain valid logos.
3. Set headerLogo = `#` while content.logo remains valid: the fixed light header/favicon skip the invalid candidate. Dark header keeps primary-logo preference.
4. Existing valid App logos still win. Draft/foreign-organization roots do not supply a display fallback. Tests compare App metadata and JSON-LD to main.

## 3. Heading colour

`content.headingColor` accepts `theme` or `dark`; omitted/theme retains existing HTML. Child pages inherit only this presentation setting from the resolved root, unless their content explicitly sets it. Invalid values fail at `content.headingColor` in all page write/preview handlers. No database column.

Opt-in CSS changes H1–H6 only, including Markdown. Default surfaces use #111827 / #f9fafb; CTA/download and explicit opaque hex backgrounds select black/white by contrast. Native white/dark card surfaces reset their inherited neutral. Centered hero media retains white over its dark overlay. Theme colours for links/buttons/accents remain untouched. Arbitrary custom CSS/embedded content is outside the setting.

Tests compare 56 combinations directly against main 548b0ea (seven kits × default/theme × root/child × render versions). Existing 80 light HTML hashes remain checked. Complete child route tests cover inheritance/overrides, metadata and JSON-LD parity. Palette tests cover all kits and 4,096 explicit colours. SSR checks cover CTA early return and nested card surface reset.

## 4. YouTube retry

After a confirmed seek and 1,800ms without playback, state -1 (unstarted) or 5 (cued) gets one extra playVideo. Another 1,800ms without progress retains the existing blocked/press-play UI. No extra seek is sent by this retry. Unknown, paused, buffering, already-playing, navigation-only, disposed, errored and superseded requests do not get this automatic playback retry. Fake iframe/mocked timer tests require no real provider.

## Review and verification

Independent review found CTA early-return styling, nested card contrast and malformed HTTPS warning gaps; all were repaired with regression tests. Final command results are recorded below after the final run.

- Browser attempts: `DARK_STYLE_BROWSER_TESTS=1 DIRECTORY_LOGO_BROWSER_TESTS=1 ... tests/dark-style.test.ts tests/directory-logo-browser.test.ts tests/hosted-small-bugs.test.ts` ran; all three browser checks failed at Chrome launch (`Chrome exited null`), before page assertions. Browser-access host fallback was unavailable too.
- Not verified: actual 375px geometry/computed CSS, before/after screenshots, live YouTube's intermittent first-click behavior, real remote thumbnail delivery, production data. Static preview HTML exists locally in `/tmp/appai-91-qa`; it is not visual verification.
- To repeat browser checks where Chrome can launch: `DARK_STYLE_BROWSER_TESTS=1 DIRECTORY_LOGO_BROWSER_TESTS=1 SMALL_BUGS_QA_DIR=/tmp/appai-91-qa node --experimental-strip-types --test tests/dark-style.test.ts tests/directory-logo-browser.test.ts tests/hosted-small-bugs.test.ts`.

Final local run (2026-11-18 11:05 Asia/Taipei):

| Command | Result |
|---|---|
| `npm run spec:build` | Passed; AGENT_INSTRUCTIONS.md regenerated |
| `npm run typecheck` | Passed |
| `npm test` | 834 total; 823 passed, 0 failed, 11 optional tests skipped |
| `npm run lint` | Passed; 0 errors, 31 warnings |
| `git diff --check` | Passed |
| `npm run feature-map:check` | Reports four stale entries because new files cannot be staged in this sandbox; mapping entries are present |
| Supplemental read-only feature-map check | Same checker, with git ls-files including tracked + untracked files: passed, 19 features, 777 files (683 mapped / 94 ignored). Does not replace the required staged-index check |
| Both requested browser flags + new heading browser check | Chrome exits before assertions; all three browser checks remain unverified |
| Independent final review | 43 targeted tests passed, 1 browser skip; no remaining identified code defects |

`git add` and `git commit -am '#91: fix hosted branding, add neutral headings and retry video playback'` were both rejected creating the worktree index.lock outside the writable sandbox. All changes, including generated output and new tests, remain uncommitted. No bundles, alternate index/repository, or repository copies were made. No push/PR/merge/deploy occurred.

The ops inbox/run directory is outside the permitted writable roots, so the required ops append/run log could not be written here. No ops pull/commit/push was attempted; this task explicitly prohibits pushing. This QA document retains the local handoff. Next: from an authorized environment, stage the new files, rerun the stock feature-map check and the three browser checks, capture the screenshots, commit with `#91:` and append the ops handoff. Publishing remains a separate owner decision.


## Round 2 — independent-review fixes (2026-11-18 11:15 Asia/Taipei)

Start: `claude/91-pr4-small-bugs`, HEAD `5c75d0a`, clean worktree. Implemented and tested by Codex (GPT-6 family); independent read-only review by a separate Codex agent without implementation history. No DB, keys, network publication, commit, push, PR, merge or deployment. All round 2 changes remain uncommitted.

| Item | Change | Regression evidence |
|---|---|---|
| Hero text on ignored/side media | Minimal/split derive text darkness only from backgroundColor/darkMode. Centered retains its previous logic. This corrects a real rendering defect missed in round 1; the original reported page's payload remains unavailable. | 54 direct comparisons with round 1 across 3 variants × 2 modes × 3 backgrounds × 3 media cases. Only the 4 broken light minimal/split image/video cases change text colours. Centered image HTML and ordinary URLs remain byte-identical. |
| CSS image URLs | Percent-encode CSS url delimiters, whitespace, backslashes and control characters; keep ordinary URLs verbatim. | Parentheses, spaces, both quote types, backslashes, Unicode whitespace and pre-encoded URLs; optional browser checks assert parsed backgroundImage. |
| Neutral heading contrast | Share opaque #rgb/#rrggbb normalization with directory tiles. Unknown explicit surfaces mark their section as theme, excluding its headings from neutral CSS; includes Hero and CTA early-return wrappers. | Short-hex black/white and mixed-case/trimmed inputs; names, rgb(), alpha hex and CSS variables; both modes and about/hero/cta/download paths. Optional computed CSS comparisons check unknown surfaces against theme mode. |
| Child favicon | Valid own child logo wins; otherwise reuse the root header's logo selector with the child's chrome mode. Never use the child's heroImage as favicon. | 40 root-fallback cases across child modes, locale-free/explicit en routes, child photos and 5 root-logo sources; own header/content/hero logo overrides. Root mode deliberately differs from child mode. All metadata except icons compared byte-for-byte with round 1; header image matches inherited icon. |

Existing 56 default/theme HTML comparisons against `548b0ea` and the suite's historical light-page baselines pass. OG/Twitter, canonical, alternates and JSON-LD remain unchanged. Cache source/options are untouched. Public style/pages/sections docs and generated AGENT_INSTRUCTIONS.md are synchronized. No source/test files were added or removed; the feature-map description was refreshed.

| Command | Round 2 result |
|---|---|
| `npm run spec:build` | Passed; generated spec synchronized |
| `npm run typecheck` | Passed |
| `npm test` | 839 tests: 827 passed, 0 failed, 12 optional tests skipped |
| `npm run lint` | Passed; 0 errors, 31 warnings |
| `npm run feature-map:check` | Passed; 19 features, 683 mapped, 94 ignored, 777 tracked files |
| `git diff --check` | Passed |
| `DARK_STYLE_BROWSER_TESTS=1 SMALL_BUGS_QA_DIR=/tmp/appai-91-r2-qa node --experimental-strip-types --test tests/hosted-small-bugs.test.ts` | 13 non-browser tests passed; both browser tests failed at Chrome startup (`Chrome exited null`), before any browser assertions or screenshots |

The optional headless Chrome attempt blocked external requests and had no audio/video playback. No browser remained running after the attempt. Computed CSS, visual layout and before/after screenshots remain unverified; no screenshots are claimed. The browser regression is checked in for an environment where Chrome can start. No live assets or production pages were requested.

Independent review initially identified an invalid child/privacy test URL; the fixture now uses supported explicit-locale and locale-free child routes. Its rerun passed all 13 non-browser tests with 2 browser skips and found no outstanding production-code defect. Final local checks also fixed fixture-only TypeScript casts and removed an unused ESLint suppression.

Ops handoff: `~/GitHub/ops/inbox/codex.md` and `ops/runs/` are outside this sandbox's writable roots. No ops write/pull/commit/push was attempted. This document retains the required run details and the append-ready inbox entry below; copy it and this round-2 record to ops from an authorized environment. Next: independent owner review and optional browser QA. Keep all changes uncommitted under this task's instructions.

`- 2026-11-18 11:15｜APPAI｜#91 PR-4｜Round 2 修正 Hero 文字對比、CSS 圖片 URL、短 hex／未知背景標題回退、子頁 favicon；五個指定檢查通過；Chrome 啟動失敗，截圖待驗；變更未提交｜HEAD 5c75d0a；docs/apps/hosted-small-bugs-qa.md（Round 2）`
