# Platform directory and personal website — review receipt

Verified locally on 2026-10-30. This receipt describes source and local production
preview, not deployment to appai.info or the state of the other iMac.

## Delivered

- Websites `/websites`, Tools `/tools`, Apps `/apps?kind=apps` entrances.
- `/apps` retains the complete existing catalog and purpose filters.
- Product form is separate from purpose (`MEDIA`, `SOCIAL`, etc.).
- Explicit `App.tags` values `appai:kind:website`, `appai:kind:tool`, and
  `appai:kind:app` classify future entries; Universal Apps remain applications.
  Legacy demo websites have a reviewed source registry because their original
  records used the default `APP_LANDING` template. No data was migrated.
- First-party `/people/grayson` with English, Traditional Chinese and Simplified
  Chinese copy; other platform locales fall back to English. Content lives in
  `src/lib/people.ts`. Published lookup is shared by page, directory and sitemap.
- Website purpose filters collapse on mobile and desktop until requested.
- X/Twitter daily digest is a future Tool, not a new top-level category or an
  available feature in this release.

## Verification

`npm run build`, `npm run typecheck`, changed-source ESLint and `git diff --check`
passed. The final browser run against `next start` passed 11/11 flows; see
`platform-directory-qa-results.json`. It checks real Wheel Spinner/MedLogAI/demo
portfolio catalog placement, profile navigation, anchors, locale preservation,
unknown-person 404, metadata/sitemap, combined filters, an existing hosted page,
mobile overflow and keyboard navigation.

Source queries used existing configured data read-only. The final browser suite
intercepts view-tracking requests and does not call publish, editor, form,
migration or deployment endpoints. Draft-profile exclusion was reviewed in
source; there is no runtime draft-profile fixture or authenticated editing test.
Existing sign-in and backend job execution are outside these public-page checks.

Screenshots are in `docs/screenshots/platform-directory/`:

- `websites-desktop.png`, `websites-mobile.png`
- `profile-desktop.png`, `profile-mobile.png`, `profile-zh-TW.png`

## Repeat locally

Use configured database/environment access, an installed Chrome and Playwright.
Do not run `next dev` concurrently with a production build in the same checkout.

```sh
npm run build
AUTH_TRUST_HOST=true AUTH_URL=http://localhost:3100 NEXTAUTH_URL=http://localhost:3100 \
  npm run start -- --hostname localhost --port 3100
```

In another terminal:

```sh
# Set NODE_PATH only if Playwright comes from a bundled external runtime.
QA_EXISTING_PAGE=/p/medlogai node scripts/qa-platform-directory.cjs
```

Optional variables: `QA_BASE_URL`, `QA_OUTPUT_DIR`, `QA_BROWSER_CHANNEL`.
The default artifact folder is `/private/tmp/appai-platform-directory-qa`.

The local Next.js 16.2.10 preview returned self-redirects on English paths when
bound to `127.0.0.1`; binding to `localhost` resolved the observed issue. No global
routing or locale-prefix changes were made. Personal pages render per request;
this avoids a production-only request-context error found in the initial SSG
implementation. The final run includes both English and Chinese profile pages.

## Remaining review and publication

The personal content is a conservative first draft. Exact employment dates,
numeric career results, portrait, contact details and resume PDF are omitted
until confirmed. This is a version-controlled editorial site, not a member
self-service editor. Existing database-owned Hosted Pages keep their own
publication and organization permissions.

Do not equate a local preview or a pushed feature branch with a production
release. The other iMac must fetch and select this branch to continue this work;
its unpushed changes, credentials, media and running jobs still need a separate
handoff.
