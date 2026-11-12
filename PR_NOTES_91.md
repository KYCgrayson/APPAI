# #91 PR-1 — video key moments

Generic Hosted Page fields let every author attach timestamped moments to `video`. Server HTML contains real external timestamp links and Clip JSON-LD. A separate client player progressively enhances them without YouTube/Vimeo SDK scripts or new dependencies.

## Compatibility and generic fixes

- Removed fabricated `uploadDate: new Date().toISOString()`. Only supplied publication metadata is emitted. Fixed-clock direct-file render regression compares against the literal pre-change HTML with only that property removed.
- Strict URL parsing replaces substring/regex detection and raw URL embedding. Platform-built YouTube nocookie embeds handle watch/shorts/embed/short URLs; Vimeo unlisted hashes survive. Unknown URLs fail preview/writes and existing malformed rows render a localized unavailable message. Provider watch URLs no longer masquerade as direct-byte `contentUrl` in JSON-LD.
- Click-to-load facades replace eager provider frames, and player failures/blocked playback have localized visible fallbacks. The requirement for identical old provider markup conflicts with the mandatory facade: YouTube/Vimeo HTML necessarily changes even without new fields. Direct-file and GIF layout is retained; no moments heading/list appears without moments. Existing broad typography fixture used an unsupported bare web page as a video URL; corrected it to a fictional mp4 and adjusted only its video schema/source.
- Existing `data.id || section.id` takes priority. Only sections with moments and no authored ID receive a fallback `video-<rendered index>` anchor. Explicit IDs remain stable across reordering.

## CSP — exact diff

No changes to `next.config.ts`: `frame-src` already includes `https://www.youtube-nocookie.com` and `https://player.vimeo.com`; `img-src 'self' data: blob: https:` already includes `https://i.ytimg.com`. `script-src` is unchanged. No SDK scripts, preconnects or provider API fetches were added.

## Iframe sandbox and messaging

Both providers retain `sandbox="allow-scripts allow-same-origin allow-presentation"`: scripts are needed for playback, same-origin preserves provider identity/storage and verifiable postMessage origins, presentation permits presentation/casting APIs; fullscreen is granted separately through `allow` and `allowFullScreen`. No popups, forms, downloads or top navigation permissions. `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`, `allowFullScreen`, meaningful localized title and `referrerPolicy="strict-origin-when-cross-origin"` are explicit.

This is a minimal sandbox candidate, not a live-provider compatibility claim. Network/browser provider QA remains pending; no evidence warranted dropping it. If real playback exposes a provider incompatibility, reproduce it and document the necessary relaxation before release. Messages require both the exact provider origin and the active iframe's `contentWindow`; outbound messages use that exact origin, never `*`.

YouTube uses `enablejsapi=1`, the current `origin`, listening handshake, `seekTo`/`playVideo`, and readiness/state/time/error notifications. Vimeo preserves `h`, sets `dnt=1`, uses ping/ready, `setCurrentTime`/`play` and playback/error events. Native files wait for metadata before setting `currentTime`. Latest requests win; readiness/seek acknowledgement times out after eight seconds, and lack of playback acknowledgement reports “press play”.

## Embed terms checklist

| Check | YouTube | Vimeo |
|---|---|---|
| Privacy | `www.youtube-nocookie.com`; thumbnail only before interaction | No frame before interaction; `dnt=1`; optional authored thumbnail |
| No autoplay without user action | No autoplay URL flag; play command only on a click | No autoplay URL flag; play command only on a click |
| Branding/player controls | Provider controls and branding retained; no overlays over the active frame or branding-suppression params | Provider controls, attribution and branding retained |
| Attribution link | Localized “Watch on YouTube” link always available | Localized “Watch on Vimeo” link always available; unlisted hash retained |

Provider terms and publisher rights still apply. This checklist records implementation behavior, not a claim of provider certification. Sources: [YouTube parameters](https://developers.google.com/youtube/player_parameters), [YouTube player reference](https://developers.google.com/youtube/iframe_api_reference), [Vimeo player documentation](https://github.com/vimeo/player.js), [Vimeo wire protocol source](https://github.com/vimeo/player.js/blob/master/src/lib/postmessage.js).

## Structured data field review

Checked against [Google's VideoObject/Clip documentation](https://developers.google.com/search/docs/appearance/structured-data/video):

| Field | Output |
|---|---|
| `name`, `description` | Existing caption/fallback; moment title becomes Clip name |
| `uploadDate` | Supplied ISO 8601 publication date/timestamp only; no fake “now” |
| `thumbnailUrl` | Supplied HTTPS image or real YouTube thumbnail; omitted for other unknown thumbnails |
| `duration` | Supplied ISO 8601 day/time duration only |
| `contentUrl` | Direct media bytes only |
| `embedUrl` | Platform-built provider player URL; Vimeo privacy hash retained |
| `hasPart` | Sorted/deduplicated Clip array; unique `startOffset`, hosted-page `url`, next start as `endOffset`; final end only with duration |

Google requires `name`, `thumbnailUrl` and `uploadDate` for video rich-result eligibility; omission of unavailable metadata intentionally limits eligibility. Clip `endOffset` is recommended, not required. A facade, crawlability, page content and Google's eligibility decisions may also affect discovery; no rich-result guarantee.

## Limitations and release QA

- Initial `?t=` selects the facade time but waits for a click to load a provider, honoring the no-frame-before-interaction requirement. History navigation seeks loaded players without starting paused media.
- YouTube's direct iframe wire handshake is lower-level than its public SDK and may change; documented commands/events are used without loading the SDK, as required. Readiness/seek acknowledgements and external links bound failure.
- Player privacy/region/embedding restrictions and native file codec/CORS/availability remain external. Third-party thumbnails can contact their host before playback; this is not a zero-network facade. Vimeo has no auto-discovered thumbnail. GIFs remain images with no seeking.
- Browser playback and sandbox compatibility across providers, iOS/Android autoplay restrictions, actual mobile/dark layout and assistive-technology announcement timing require live QA. Automated tests cover parsing, contracts, markup, messaging state and routing behavior.

## Validation

- `npm run spec:build`: passed; regenerated `AGENT_INSTRUCTIONS.md`. `docs/spec/overview.md` remains 105 lines.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with 32 warnings and zero errors (includes existing warnings and the two video image warnings; direct images avoid an image proxy/dependency and preserve legacy markup).
- `npm test`: passed, 580 passed / 1 existing database integration test skipped. Includes 23 new tests across URL/time/contract/JSON-LD, API write paths, SSR/equivalence, navigation, message trust/state and actual client hook lifecycle (including native metadata deferral).
- `npm run build`: attempted; Turbopack cannot bind its CSS worker port in this sandbox (`Operation not permitted`).
- `npm run build -- --webpack`: compilation and TypeScript passed; `/llms.txt` prerender then failed because `DATABASE_URL` is not configured. No environment files were edited.
- `git diff --check`: passed. No dependencies added; no commits, pushes or merges.

## Changed files

- Player/rendering: `src/templates/sections/VideoSection.tsx`, `VideoPlayer.tsx`, `video-strings.ts`; `src/templates/shared/PageRenderer.tsx`, `Prose.tsx`; `src/app/p/[...segments]/page.tsx`.
- Shared logic: `src/lib/video-url.ts`, `video-data.ts`, `video-controller.ts`, `video-navigation.ts`, `video-jsonld.ts`, `hosted-editorial-links.ts`, `validations/page.ts`, `sanitize.ts`, `page-preview.ts`, `template-registry.ts`.
- API: `src/app/api/v1/pages/route.ts`, `src/app/api/v1/pages/[slug]/route.ts`, `src/app/api/v1/pages/[slug]/sections/[order]/route.ts`, `src/app/api/v1/sections/route.ts`.
- Tests: `tests/video-contract.test.ts`, `video-api.test.ts`, `video-controller.test.ts`, `video-navigation.test.ts`, `video-player.test.ts`, `video-render.test.ts`; `tests/helpers/video-player-fixture.mjs`; `tests/fixtures/video-legacy.html`, `typography-page.json`, `typography-default.html`.
- Documentation: `docs/spec/sections.md`, generated `AGENT_INSTRUCTIONS.md`, `TODO.md`, `PR_NOTES_91.md`.
