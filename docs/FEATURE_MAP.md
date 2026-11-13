# APPAI feature map

Read this first to find a feature, then open its entry files in the order listed.
Before changing code, read the relevant entry and its linked files. Update this
file and [feature-map.json](feature-map.json) in the same commit when you add,
move or remove files; refresh descriptions when behavior or entry points change.
No separate approval is needed to maintain the map.

Run `npm run feature-map:check` (or `node scripts/check-feature-map.mjs`). The
checker uses `git ls-files`, so **stage new files before checking**. CI blocks
stale feature/ignore globs, unmapped tracked files, and mismatched IDs/headings.
Optional local enforcement: `git config core.hooksPath .githooks`; the hook blocks
failures and warns/skips if Node is unavailable. Node 22 is sufficient; no install
is needed for the check.

JSON globs are repo-relative: `*` stays within a directory, `**` crosses directories
(`**/` also matches zero directories); brackets and parentheses are literal.
Subsystem globs cover files within an established feature; shared files may
belong to multiple features. The check verifies coverage, not prose accuracy.
Keep new locations specific; do not add catch-all source/test ignores. `ignore`
is for repository housekeeping, generated copies, and static reference assets.

**Ignored files:** `tests/backlog-todo.test.ts` only checks `TODO.md` Backlog #32's
task formatting, the exact two remaining follow-ups, and absence of environment
details. It tests repository housekeeping rather than product behavior, so it
remains ignored alongside `TODO.md`.

### platform — Public directory, dashboard and shared shell

Home, websites, tools and app directories help visitors discover published work; app details and the dashboard share the platform chrome and base UI. Shared persistence starts at the Prisma schema and database client. Legacy static support/policy pages live in `public/ishift/`.
Entry files: [home](../src/app/[locale]/page.tsx), [PlatformDirectory.tsx](../src/components/PlatformDirectory.tsx), [app details](../src/app/[locale]/apps/[id]/page.tsx), [dashboard](../src/app/dashboard/page.tsx), [schema.prisma](../prisma/schema.prisma), [db.ts](../src/lib/db.ts).
Shared public visibility: [hosted-page-visibility.ts](../src/lib/hosted-page-visibility.ts) gates S1–S8; App bindings require a same-organisation root.
Watch out: directory classification uses published root-page content; a launch link also depends on the Universal App runtime's readiness predicate.

### page-publishing — Hosted-page publish API

Creates, validates, previews, updates and publishes hosted pages and their locale variants, plus public image uploads and section/preset discovery. The dashboard groups the publisher's logical pages and locale chips under root headings, with UTC Created/search/status URL filters and cursor pagination.
Entry files: [page API](../src/app/api/v1/pages/route.ts), [single-page API](../src/app/api/v1/pages/[slug]/route.ts), [validation](../src/lib/validations/page.ts), [template-registry.ts](../src/lib/template-registry.ts), [sanitize.ts](../src/lib/sanitize.ts), [upload](../src/app/api/v1/upload/route.ts).
Dashboard entry: [dashboard-pages.ts](../src/lib/dashboard-pages.ts) aggregates logical creation dates before paging and selects locale summaries. Each logical page has its default locale's effective status, overridden by the strongest removal state: Trash, Unpublished (admin), Unpublished (owner). The six exclusive status filters retain per-locale chips. [app-hosted-page-binding.ts](../src/lib/app-hosted-page-binding.ts) validates POST/PUT bindings. Tests: `tests/pr5-*.test.ts`, `tests/fixtures/pr5-*`, and `tests/helpers/pr5-*.mjs` cover pre-change hashes, main's locale order under different scan orders, S1–S8, real aggregate SQL in SQLite, dashboard rendering, links and binding errors.
Owner/admin removal: [page-management.ts](../src/lib/page-management.ts) owns the logical-page transition matrix, batch expansion, plan checks and atomic audit; [page-write-guard.ts](../src/lib/page-write-guard.ts) shares tree locks across nine public page writes and App POST/PUT. Removed slugs remain reserved throughout their organisation across parents/locales; conditional page updates map lost writes to audited removal conflicts or scope_changed. [page-dto.ts](../src/lib/page-dto.ts) allowlists every public page response. [dashboard actions](../src/app/api/dashboard/pages/actions/route.ts) require a same-origin session and confirmed expansion counts; dashboard/admin controls share the service.
Migration M1: [additive SQL](../prisma/hosted-page-removal-migration.sql), [guarded abandonment SQL](../prisma/hosted-page-removal-down.sql), and [read-only schema verifier](../scripts/check-hosted-page-removal-schema.mjs). Apply SQL manually before deployment; normal rollback preserves schema and audit. `tests/pr5-removal-postgres.test.ts` needs a disposable local `TEST_DATABASE_URL` for M1 twice/verification/CHECK and 80 deterministic races between real publish/create routes and owner actions on two independent Prisma connections. Transaction and advisory-wait timeouts default to 15 seconds; set `TEST_DATABASE_TIMEOUT_MS` for slower hosts. `tests/pr5-actions.test.ts` exercises the real confirmation component; `tests/pr5-actions-browser.test.ts` is optional Playwright QA (`PR5_BROWSER_TESTS=1`, existing Playwright/Chrome only, optional `PR5_PLAYWRIGHT_MODULE`). Tests do not use the application's database URL.
Watch out: root slugs belong to an Organization across locales; child pages do not create directory listings, and publishing does not imply listing approval.

### hosted-pages — Hosted routes, templates and submissions

Resolves `/p/` root, child, policy and fullscreen tool pages, with navigation, branding, section rendering, typography and store badges. Forms and simple orders validate submissions against their stored page section.
Entry files: [hosted route](../src/app/p/[...segments]/page.tsx), [hosted layout](../src/app/p/[...segments]/layout.tsx), [PageRenderer.tsx](../src/templates/shared/PageRenderer.tsx), [section-components.tsx](../src/templates/shared/section-components.tsx), [prose.css](../src/templates/shared/prose.css) + [prose-theme.ts](../src/lib/prose-theme.ts) (Markdown styling, theme-aware link contrast), [form submission](../src/app/api/v1/form-submit/route.ts), [order submission](../src/app/api/v1/simple-order-submit/route.ts).
Navigation: [site-nav.ts](../src/lib/site-nav.ts) keeps Home on non-root pages; [hosted-navigation-copy.ts](../src/lib/hosted-navigation-copy.ts) owns locale-matched Home/AppAI/404 labels and focus styling. [Hosted not-found boundary](../src/app/p/[...segments]/not-found.tsx) retains site chrome; [shared fallback](../src/app/not-found.tsx) recovers only public roots from the middleware path. [Render coverage](../tests/hosted-navigation-render.test.ts) checks root/child/policy/404, desktop and open mobile drawer, locales, explicit policy filtering, all templates, exact publisher button colours and one main landmark per 404. [Viewport coverage](../tests/hosted-navigation-browser.test.ts) checks one Home and visible account controls at 320/375/768/1280px using an existing Chrome installation. [Publisher HTML baseline](../tests/fixtures/pr5-f0-publisher-baseline.json) captures main 949fda4 for the 12 existing PR-5 fixture URLs; [full HTML baseline](../tests/fixtures/pr71-navigation-baseline.json) compares every byte after only the approved navigation deltas, while publisher content, sibling nav, sitemaps and llms remain covered.
Header constraints: root navigation disappears when filtering leaves only Home. Branding and current desktop/drawer links expose `aria-current="page"`. Root headers preserve main's exact classes at every width (24px gutter, 12px branding gap, 16px utility gap, 40px hamburger with `-mr-2`); render coverage loads main's actual source and compares four logo/nav combinations, both auth/drawer states and mobile/desktop class sets, removing only AppAI links and `aria-current`. Compact spacing applies only to non-root pages below md: 16px gutters, a 4px account/menu gap and 44px compact controls. Full sign-in controls retain their 36px height; viewport coverage includes the 399/400px account transition and 640px account layout.
Non-root mobile alignment tradeoff: existing page/drawer content retains its 24px gutter. Moving the header's 16px gutter to match would reduce the calculated zh-TW title budget at 375px with a 32px logo from 171px to 163px, below the required 170px. Without a logo the budget is 207px; at 320px the budgets are 116px/152px. Desktop and root alignment remain unchanged.
Watch out: a section change can also require registry, validation and sanitization changes in `page-publishing`; check those alongside the renderer.

### auth — Accounts, device authorization and API keys

Google sign-in creates the user's Organization; browser sessions, API keys and device authorization support the dashboard and publishing clients. Shared Organization context and request guards also serve Universal Apps.
Entry files: [auth.ts](../src/lib/auth.ts), [api-auth.ts](../src/lib/api-auth.ts), [device approval UI](../src/app/[locale]/auth/device/page.tsx), [device-approval.ts](../src/lib/device-approval.ts), [device initiation](../src/app/api/v1/auth/device/route.ts), [organization-context.ts](../src/lib/organization-context.ts).
Watch out: browser sessions and Organization-scoped bearer keys are separate authentication paths; device approval is a human action.

### i18n — Platform and hosted-content languages

Platform routes use next-intl and nine message catalogs; hosted content resolves publisher-provided locale variants, including Chinese script conversion. Locale helpers bridge these sets and support locale-free app launch pages.
Entry files: [routing.ts](../src/i18n/routing.ts), [messages](../src/messages/en.json), [middleware.ts](../src/middleware.ts), [locale-match.ts](../src/lib/locale-match.ts), [platform-locale.ts](../src/lib/platform-locale.ts), [hosted-page-resolver.ts](../src/lib/hosted-page-resolver.ts).
Watch out: `/p/` has its own locale system and `/app/` skips next-intl routing; publisher copy belongs in hosted content rather than platform messages.

### seo — Metadata, canonical URLs and discovery indexes

Builds platform and hosted-page metadata, structured data, robots rules, and sharded sitemaps. Hosted URL helpers keep policy, child-page, alternate-language and canonical links consistent.
Entry files: [platform-metadata.ts](../src/lib/platform-metadata.ts), [hosted-page-seo.ts](../src/lib/hosted-page-seo.ts), [hosted-page-urls.ts](../src/lib/hosted-page-urls.ts), [sitemap index](../src/app/sitemap.xml/route.ts), [sitemap-data.ts](../src/lib/sitemap-data.ts), [json-ld.ts](../src/lib/json-ld.ts).
Watch out: hosted-page mutations expire the sitemap tag immediately and revalidate the hosted dynamic layout; external llms caches may retain responses for an hour. Index queries use the shared publication/organisation predicate; external canonicals affect directory links and sitemap inclusion too.

### game-platform — Game discovery, embedding, rooms and leaderboards

Own-game hub/detail pages lead to static play through a runtime HTML shell; published external games use the `game` section. Shared APIs provide rooms, runs, scores, profiles and leaderboard reporting.
Entry files: [games-catalog.ts](../src/lib/games-catalog.ts), [game details](../src/app/[locale]/games/[slug]/page.tsx), [runtime HTML](../src/app/games/[slug]/runtime/route.ts), [GameSection.tsx](../src/templates/sections/GameSection.tsx), [rooms.ts](../src/lib/rooms.ts), [leaderboard.ts](../src/lib/games/leaderboard.ts), [sync-games.sh](../scripts/sync-games.sh).
Watch out: middleware and client compatibility redirects preserve game queries/fragments; static play stays on the same origin for browser sessions. Rebuild served copies with `scripts/sync-games.sh`.

### guess-duel — Guess Duel deduction game

Two-player digit guessing supports one-device play, AI, fragment-based relay and online rooms. Rules, secret commitments, transport and UI are kept in the standalone Vite game.
Entry files: [main.ts](../games/guess-duel/src/main.ts), [game.ts](../games/guess-duel/src/logic/game.ts), [commit.ts](../games/guess-duel/src/logic/commit.ts), [online.ts](../games/guess-duel/src/net/online.ts), [relay codec](../games/guess-duel/src/relay/codec.ts), [UI](../games/guess-duel/src/ui/app.ts).
Watch out: relay fragments and device-local secrets must survive navigation; the shared rooms service lives under `game-platform`.

### puzzles — River Crossing, Night Bridge and Water Pouring

Three procedural 3D puzzles share a collection UI, scene infrastructure, local progress, share cards and challenge routing. Each puzzle keeps its own rules and scene module.
Entry files: [main.ts](../games/puzzle/src/main.ts), [registry.ts](../games/puzzle/src/puzzles/registry.ts), [river rules](../games/puzzle/src/puzzles/river/logic.ts), [bridge rules](../games/puzzle/src/puzzles/bridge/logic.ts), [water rules](../games/puzzle/src/puzzles/water/logic.ts), [routing.ts](../games/puzzle/src/routing.ts).
Watch out: all three playable slugs use the `river-crossing` static build; the Tabletop Puzzles collection is a description page, not a fourth build.

### werewolf — Pass-the-phone Werewolf

A standalone, dependency-free party game handles role dealing, night actions, voting, narration and local saves with app or human hosting. English and Traditional Chinese copy lives with the game.
Entry files: [app.js](../games/werewolf/src/app.js), [logic.js](../games/werewolf/src/logic.js), [i18n.js](../games/werewolf/src/i18n.js), [index.html](../games/werewolf/index.html).
Watch out: reload/resume must preserve the privacy handoff before showing a player's private role or result.

### tools — Wrapped tools, connector proxy and media tools

Hosted tool sections wrap existing deployments, optionally supply scoped identity, and renew iframe sessions during use. Registered connectors provide the shared backend proxy; media download and PDF sections supply other tool UIs.
Entry files: [IframeToolSection.tsx](../src/templates/sections/IframeToolSection.tsx), [iframe-tool-session.ts](../src/lib/iframe-tool-session.ts), [renewal hook](../src/templates/sections/use-iframe-tool-session.ts), [connector proxy](../src/app/api/connect/[connector]/[...path]/route.ts), [registry.ts](../src/lib/connectors/registry.ts), [MediaDownloaderSection.tsx](../src/templates/sections/MediaDownloaderSection.tsx).
Watch out: iframe URL allowlists and CSP in `next.config.ts` must agree; connectors are owner-maintained, and iframe-tool sessions differ from Universal App runtime sessions.

### video-moments — Hosted videos and timestamped key moments

Validates provider/file URLs, normalizes moments and optional SEO metadata, and renders server-side timestamp links, VideoObject/Clip JSON-LD and click-to-load players. SDK-free provider control, native file seeking and same-page history navigation share localized status and fallback links. Legacy provider/file rows retain their media rendering; unknown stored web URLs use external link cards.
Entry files: [VideoSection.tsx](../src/templates/sections/VideoSection.tsx), [video-data.ts](../src/lib/video-data.ts), [video-url.ts](../src/lib/video-url.ts), [video-jsonld.ts](../src/lib/video-jsonld.ts), [VideoPlayer.tsx](../src/templates/sections/VideoPlayer.tsx), [video-controller.ts](../src/lib/video-controller.ts), [video-navigation.ts](../src/lib/video-navigation.ts), [LegacyVideoSection.tsx](../src/templates/sections/LegacyVideoSection.tsx), [video-strings.ts](../src/templates/sections/video-strings.ts).
Tests: `tests/video-{api,contract,controller,navigation,player,render}.test.ts`, `tests/helpers/video-player-fixture.mjs`, `tests/fixtures/video-legacy.html` and `tests/fixtures/video-legacy-urls.json` cover the write contract, legacy markup, navigation and player lifecycle, including deterministic YouTube handshake/seek races. [stress-video-first-click.cjs](../scripts/stress-video-first-click.cjs) is opt-in Playwright QA against a loopback page using the real VideoPlayer and YouTube: 20 fresh contexts each for desktop, iPhone and Android emulation, headless Chrome with `--mute-audio`, with all contexts closed. It uses an existing Playwright install (optionally via `NODE_PATH`); it is outside `npm test` and requires loopback/network access.
Watch out: new unsupported URLs are errors on every write/preview path. Only the exact URL in the same stored section is grandfathered with a warning; untouched PATCH sections remain editable. Legacy iframes require a parsed provider ID and a rebuilt URL; unparseable provider URLs use localized external cards. YouTube listening acknowledgements and API readiness are separate; success requires position confirmation within one second, with one retry after two seconds. Publishing routes, schemas and sanitization live under `page-publishing`; the hosted renderer supplies section IDs, page URLs, locale and thumbnail priority.

### video-subtitle — Subtitle Studio and async video jobs

Transcribes/translates videos, edits subtitle text, timing, annotations and styling, then renders downloadable results. Shared job polling and video widgets implement progress, recovery and previews; the backend contract is documented here, while the backend implementation is outside this repo.
Entry files: [VideoSubtitleSection.tsx](../src/templates/sections/VideoSubtitleSection.tsx), [use-async-job.ts](../src/templates/shared/jobs/use-async-job.ts), [SubtitleEditor.tsx](../src/templates/shared/video/SubtitleEditor.tsx), [video types](../src/templates/shared/video/types.ts), [API contract](video-subtitle/api-spec.yaml).
Watch out: connector quota counts transcription rather than every render; subtitle language/script codes are separate from platform UI locales.

### universal-apps — App releases, launcher and runtime capabilities

App publishing accepts manifests and immutable source packages or pinned repositories; releases lead to the authenticated `/app/` launcher. Runtime sessions and private assets provide app/Organization-scoped capabilities; publisher UI exposes release submission and status.
Entry files: [release submission](../src/app/api/v1/apps/[id]/releases/route.ts), [manifest.ts](../src/lib/universal-apps/manifest.ts), [release-package.ts](../src/lib/universal-apps/release-package.ts), [launcher.tsx](../src/lib/universal-apps/launcher.tsx), [runtime-session.ts](../src/lib/universal-apps/runtime-session.ts), [private asset API](../src/app/api/runtime/assets/route.ts).
Watch out: a submitted or approved release is not necessarily runnable; directory cards and the launcher must share the active production deployment predicate.

### managed-hosting — Managed deployment, sandbox and activation

Runs the isolated validation/build/deploy pipeline for reviewed Universal App releases, including requested database provisioning, migrations, health checks and activation. Provider, orchestration and cutover logic have separate regression coverage.
Entry files: [managed-orchestrator.ts](../src/lib/universal-apps/managed-orchestrator.ts), [vercel-sandbox-provider.ts](../src/lib/universal-apps/vercel-sandbox-provider.ts), [vercel-sandbox-worker.ts](../src/lib/universal-apps/vercel-sandbox-worker.ts), [database-provisioner.ts](../src/lib/universal-apps/database-provisioner.ts), [activation.ts](../src/lib/universal-apps/activation.ts), [cutover.ts](../src/lib/universal-apps/cutover.ts).
Watch out: activation changes runtime availability and existing session/capability state; review launcher and runtime-session contracts alongside deployment changes.

### mcp-server — MCP publishing client

A standalone stdio MCP server exposes AppAI publishing tools and specification resources by calling the public API. Its source and package documentation live separately from the Next.js application.
Entry files: [index.ts](../mcp-server/src/index.ts), [package.json](../mcp-server/package.json), [README.md](../mcp-server/README.md).
Watch out: `mcp-server/dist/` is a tracked build copy; edit source and regenerate it with the package's build script.

### publishing-guides — Agent spec, examples and appai-publish skill

Serves the short `/spec`, topic documents, examples and full agent spec; the publishing skill adds reusable workflow guidance. Demo/QA scripts exercise published page designs.
Entry files: [overview](spec/overview.md), [spec route](../src/app/spec/route.ts), [build-agent-instructions.mjs](../scripts/build-agent-instructions.mjs), [appai-publish skill](../skills/appai-publish/SKILL.md), [personal-site example publisher](examples/publish-person-site.mjs).
Watch out: edit `docs/spec/`, then run `npm run spec:build`; the root `AGENT_INSTRUCTIONS.md` is generated.

### admin — Administration and reporting

Administration screens manage pages, apps and users, review Universal App releases, and display feedback, analytics and usage. This entry intentionally provides file locations only for the administrative API implementation.
Entry files: [admin layout](../src/app/admin/layout.tsx), [pages UI](../src/app/admin/pages/page.tsx), [apps UI](../src/app/admin/apps/page.tsx), [Universal Apps UI](../src/app/admin/universal-apps/page.tsx), [admin components](../src/components/admin/ManagedReleaseDeploymentAction.tsx), [API files](../src/app/api/admin/).

### feedback — Feedback intake and page-view telemetry

The localized public form and agent feedback API accept product reports; page-view beacons record hosted-page visits for reporting. Connector usage events also feed the administration reports.
Entry files: [feedback UI](../src/app/[locale]/feedback/page.tsx), [feedback.ts](../src/lib/feedback.ts), [feedback-server.ts](../src/lib/feedback-server.ts), [PageViewTracker.tsx](../src/components/PageViewTracker.tsx), [view tracking](../src/app/api/p/track/view/route.ts).
Watch out: feedback intake uses both middleware limits and database-backed quotas; connector usage labels are defined in `src/lib/connectors/registry.ts`.
