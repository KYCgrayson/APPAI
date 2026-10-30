# Platform directory and Grayson personal site

## Background and agreed scope

The platform currently presents websites, embedded tools and applications in one
directory. The owner approved separate entrances and a personal site on 2026-10-30.
X/Twitter digests belong under Tools; building a digest is outside this change.

Entrances: Websites, Tools, Apps. Keep `/apps` as the existing complete directory;
the Apps entrance can select application form without removing the old directory.
Use `/websites`, `/tools` and `/people/grayson`, with platform locale support.

## Cause and findings

- Existing `App.category` describes purpose, not product form. Preserve that axis.
- Both websites and tools can use HostedPage. A hosted-page URL alone cannot classify them.
- Existing pages, publication gates, application launch checks and URLs must survive.
- First-party personal content is reviewed and version-controlled for this first
  release. This does not add member-managed profiles or a new editing system.
- No migrations, database writes, production deployment, backend restart or X
  integration are needed to review this change locally.

## Failure cases considered before implementation

1. Unpublished copy becomes visible through a directory, metadata or sitemap.
2. An embedded tool is presented as a website because it has a hosted page.
3. Form filtering removes purpose filters or the selected locale.
4. Existing `/apps`, `/apps/{id}`, `/p/{slug}` or `/app/{type}` stops working.
5. An unavailable Universal App is advertised as launchable.
6. Unknown/unpublished people become public, including through metadata.
7. Mobile navigation becomes clipped or inaccessible.
8. Personal content invents contact details, outcomes, dates or resume downloads.
9. X digest is shown as an available feature before it exists.

## Checklist and progress

- [x] Refresh remote references and verify both attached main branches match GitHub.
- [x] Preserve local My Tools changes; work only in AppAI on a feature branch.
- [x] Inspect current routes, catalog, locale handling and bundled Next.js guides.
- [x] Record scope and failure cases; assign independent scope review.
- [x] Add product-form classification independently from purpose.
- [x] Add responsive navigation, homepage entrances and directory views.
- [x] Build a reusable published editorial-profile registry and Grayson site.
- [x] Verify browser flows with read-only source data and record screenshots/results.
- [x] Record delivered state and remaining content review/publication steps.

## QA and passing criteria

Use browser E2E as the behavioral check. Capture desktop and mobile screenshots
and machine-readable results. Check all three entrances, purpose filter plus form,
Chinese/English routing, the personal-site anchors, unknown-handle 404, shared
publication gates and a representative existing hosted page. Confirm horizontal
overflow is absent and primary navigation works by keyboard. Run type checking
and lint for changed code as supporting checks, not substitutes for E2E.

Use existing configured data read-only. Do not create fixture rows in production
or invoke publish/deploy endpoints. If external data or runtime blocks a check,
record it as unverified. Do not report local preview as a live publication.
