# Own-game pages and play routing (#73)

The five game pages have distinct names, descriptions, instructions, parent FAQ,
metadata, covers and structured data. `/games/tabletop-puzzles` is a page-only
collection of the three logic puzzles, with its own canonical and sitemap entry.
The catalog separates page slugs from static build directories; middleware,
reserved-slug validation, rewrites, homepage cards and sitemap use that catalog.

| Page | Static build | Existing startup selector |
|---|---|---|
| `/games/river-crossing` | `public/games/river-crossing/index.html` | `game=river` |
| `/games/night-bridge` | Same file | `game=bridge` |
| `/games/water-pouring` | Same file | `game=water` |
| `/games/guess-duel` | `public/games/guess-duel/index.html` | Existing room/relay handling |
| `/games/werewolf` | `public/games/werewolf/index.html` | Existing startup handling |

## Play wrapper

`next.config.ts` rewrites the five locale-free `/games/{slug}/play` URLs to
`/games/{slug}/runtime`. The Node route handler reads the allowlisted build's
static HTML and injects the platform navigation through `game-play-shell.ts`.
The static asset URLs remain unchanged. Output tracing explicitly includes the
HTML files so they are available to the deployed handler. Play responses are
private/no-store and carry `X-Robots-Tag: noindex, follow`.

HTML injection keeps the game in the top-level window. An iframe would add a
second location/history and require coordination for fragments, shared URLs and
sign-in returns, as well as a framing-header exception. The chosen wrapper keeps
the original location, cookies, session/local storage, API origin and CSP.

The injected CSS reserves the bar's space with body padding. The puzzle's fixed
`#app` controls are inset below it; menus and modal heights fit the remaining
viewport. The canvas and original scene sizing stay intact. The wrapper hides
the puzzle collection's old `.about-link` while its replacement bar is present.
Unwrapped static HTML retains the original link.

## Puzzle selection and compatibility

`games/puzzle/src/routing.ts::resolveRoute` already reads `game=river|bridge|water`.
Each Play button supplies that selector. **No game source, bundle or build was
changed in round 3.** The wrapper adds a default selector before the game module
only when a bare puzzle Play URL has no `game`, `level`, `challenge` or `claim`.
It appends to the existing raw query and keeps the fragment. Existing state
payloads remain unchanged. Its history hooks call the original browser methods
and then update only the Game info link to match internal puzzle selection;
the collection home links back to `/games/tabletop-puzzles`.

Round 2 server redirects still preserve the full raw query on old room,
puzzle/challenge and leaderboard-claim links. The browser compatibility component
forwards hash-only links, including `#r=` relay payloads. Language-only links stay
on detail pages with matching Play links and query-free canonicals. `/p/` handling
and leaderboard API/board identities remain unchanged.

Page copy, hub cards, homepage strip, breadcrumbs, footer links and the play bar
support all nine platform locales: en, es, zh-TW, zh-CN, ja, ko, de, fr, hi. Only
unknown locale codes fall back to English. Play links keep the selected locale
so the bar does not switch to English when a game uses its own fallback strings. `locale` takes precedence over legacy `lang`, then the
`NEXT_LOCALE` cookie. Werewolf's old `lang=zh` maps to Traditional Chinese; new
Simplified Chinese links use `lang=zh-CN`, which its existing language detector
also accepts. The underlying games retain their existing English/Traditional
Chinese content.

## Verification

Coverage includes catalog and reserved/page-only slugs, nine-language copy and
FAQ completeness, visible markup, canonical/alternate metadata, VideoGame /
CollectionPage / FAQPage / BreadcrumbList, sitemap entries, middleware, redirects,
raw query/hash forwarding, runtime HTML/assets and actual injected startup/history
code evaluated against a browser-location fixture.

Required checks: `npm run typecheck`, `npx eslint src tests`, `npm test`,
`npm run spec:build`.

Browser layout and deployed route verification remain pending: the local preview
server was denied permission to listen (`EPERM`) in this sandbox. Automated
fixtures do not verify 375px rendering, WebGL interaction, real room sessions or
authenticated leaderboard sign-in/claim returns.
