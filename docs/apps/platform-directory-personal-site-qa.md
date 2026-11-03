# Hosted personal website QA

Use fictional data only. `scripts/qa-seed-personal-site.cjs` publishes `qa-person` / Alex Rivera (QA) in en, zh-TW and zh-CN through the local Pages API with `?upsert=true`. Set APPAI_API_KEY, APPAI_BASE_URL and QA_IMAGE_BASE (HTTPS or HTTP on localhost/127.0.0.1) externally; never store credentials in the repository. Images: phone.png, web.png and icon.png.

The seed also creates a minimal English-only `qa-person-unlisted`; leave its App unapproved. The orchestrator must approve `qa-person` using the existing admin approve action before directory QA. PERSON pages are live immediately; directory listing requires AppAI review. Switching an App-owning default root to PERSON resets approval; ordinary PERSON edits, children and non-default locales preserve it. The implementation agent performs no database writes and does not execute the seed.

Run `scripts/qa-platform-directory.cjs` against the local server with Playwright available and QA_EXISTING_PAGE set. Its 11 checks cover directory entrances, the approved PERSON listing and exclusion of the unapproved fixture, hosted-page content, anchors and external links, form/category separation, Chinese hosted locale URLs, unknown-person 404, metadata/sitemap, existing hosted pages, mobile overflow at 375px, and keyboard navigation.

Build/browser checks belong to the orchestrator. Implementation verification: typecheck, ESLint for changed source/scripts, unit tests including root/child slug ownership and PERSON approval, diff whitespace check, and a residual personal-name scan.

The demo-portfolio, wheel-spinner and medlogai fixtures must already exist in the target DB.

Security review: POST root creation checks all root locale owners before creation/upsert. `/api/v1/pages/[slug]/children` is read-only and scopes both root and children to the caller organization. `/api/v1/pages/preview` only validates/sanitizes, performs no writes or slug-availability checks, and may report valid content for a slug the caller cannot publish. The ownership preflight is not a database-level concurrency constraint; simultaneous first claims of an unused slug in different locales remain a possible race under the existing schema.
