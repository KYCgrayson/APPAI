# Five in a Row (Gomoku)

Small, standalone **freestyle Gomoku** for AppAI. Plain static HTML, CSS and ES
modules, with no build step, npm dependencies, external assets or analytics.

## Run

```bash
cd games/five-in-a-row
export PATH="$HOME/.local/node-v24.22.2-darwin-arm64/bin:$PATH"
npm run dev  # python3 -m http.server 5181
# Open http://localhost:5181/
npm test     # node --test tests/*.test.mjs
```

The source follows the `static` convention used by `games/werewolf/`.
`index.html` deliberately contains exactly `<meta charset="utf-8">`, so the
sync script can insert its deployment base. Registration in that script and the
site catalog, and copying into `public/`, are separate integration work.

## Rules and modes

- Black (seat 0, filled symbol ●) starts; white (seat 1, outlined symbol ○)
  follows. Place one stone per turn on an empty **intersection**.
- An unbroken horizontal, vertical or diagonal line of **five or more** wins.
  Overlines count. A full board without a winning line is a draw.
- This is freestyle: **no renju restrictions**, forbidden double threes,
  forbidden double fours, special openings or swapping. Renju could be a later
  option; it is not implemented here.
- Choose 15 × 15 (default), 13 × 13 or 9 × 9 (small / for kids).
- **Computer:** easy, normal or hard; choose black or white. All levels take
  immediate wins and block immediate losses. Easy otherwise chooses randomly
  near existing stones. Normal occasionally chooses a weaker nearby move.
  Hard ranks open fours, double fours, four-plus-three and double-three threats,
  and searches the opponent's reply for the best six quiet candidates.
- **Same device:** alternate turns on one device.
- **Room code:** two devices; the creator is black. Joining the second seat
  automatically starts the game. The client also implements the API's Start
  call; with two seats there is normally no separate waiting-to-start step.
- Undo removes one move on the same device. Against the computer, it removes
  your previous placement and any reply, returning to your turn. It also works
  from a result screen. The computer's opening cannot be undone on its own.
  Rooms never allow undo. Local rematches retain size, level and side; room
  rematches use a new room.
- The final board remains visible. Rings mark the complete winning line,
  including overlines; a small square marks the last stone. Filled dots and
  hollow rings inside stones, player names and symbols distinguish both sides.

## Touch, keyboard and accessibility

The normal board fits a 360 px wide screen without page-level horizontal
scrolling. On a phone, intersections are smaller than 44 px, including the
9 × 9 board. Every placement therefore uses **tap to preview, then tap the same
point again or press the ≥44 px Place button**. Choosing another point moves
the preview. In room games there is also a Clear preview button.

**Zoom** makes each intersection at least 46 × 46 px, with scrolling contained
inside the board in both directions. Browser page zoom remains enabled.
Other controls are at least 44 px tall. The layout respects safe-area insets,
centers on desktop and limits the normal board to 720 px.

Tab reaches the board once. Arrow keys move among intersections; Home/End move
within a row (Ctrl+Home/End reach the board ends). Enter or Space previews a
point, and a second activation confirms it. Escape clears the preview. Occupied
points remain focusable for inspection. Grid cells have translated row, column,
stone and marker labels. A persistent polite live region announces turns,
previews, results and connection errors. System reduced-motion is respected.
Computer replies announce their coordinate (for example, “Computer played H8”)
and the next turn or result in the selected language. Room-code joining uses a
submit form: both the first click and Enter submit, with translated validation.

Player symbols in visible text use solid black/white stone icons on round wood
badges, with the board stones' radial fills in both themes. The end screen shows
the result once, in the result panel, while retaining the placed-stone count.
Bright winning rings have a dark outer edge; the last-move square keeps
a visible yellow fill even on a fitted 15 × 15 phone board. Action buttons wrap
between controls rather than breaking words to fit a fixed three-column row.

## Languages, appearance and saving

Complete UI dictionaries: **en, es, zh-TW, zh-CN, ja, ko, de, fr, hi** (Devanagari).
`?lang=<code>` wins; otherwise the language comes from `navigator.languages`,
first exact supported matches, then primary subtags, defaulting to English.
Chinese Hant/TW/HK/MO maps to Traditional; other Chinese maps to Simplified.
The picker updates `?lang=`, `<html lang>` and the document title.
Placed-stone counts use `Intl.PluralRules` with one/other forms for English,
Spanish, German, French and Hindi; Chinese, Japanese and Korean use one form.

Appearance follows `prefers-color-scheme` by default. Auto/light/dark can be
selected during setup or play. Settings and the current game use
`localStorage["five-in-a-row:v1"]`. Reload resumes a checked game; a pending
preview is cleared. Returning home preserves a Resume button. Setup choices do
not change the saved game's mode. A storage failure displays a translated
warning and leaves the game playable in memory.

## Rooms API

The only fetches are to `/api/rooms` on appai.info (the page's own origin when
hosted on appai.info or www.appai.info). No configurable API URL is accepted.
Local play makes no network calls. A local Python server can run every local
mode; online calls require an origin permitted by the rooms API.

Create requires a signed-in session on appai.info. A 401, 403 or network failure
on Create displays translated sign-in guidance with the same
`https://appai.info/login?callbackUrl=…` flow used by the reference client,
returning to this game after sign-in.
Joining and playing require no account. `?room=ABC234` joins or resumes that
room. Tokens are stored per room **and API origin** under
`five-in-a-row:v1:room:<origin>/<code>`, never in links or URLs.

Snapshots contain a compact `0/1/2` board string, full move history, turn,
winner, winning line and transport revision. History entries are
`[intersectionIndex, seat]`; `[-1, seat]` records an idle skip. Every snapshot is
replayed with the same pure engine used locally. Retained API moves are checked
against that history, and a known history cannot be rewritten. The two-seat
API creates at version 1, joins at version 2, then increments once per game
event. This lets reload recover trailing skips even when the last real move has
fallen outside the API's last-20-move log. Numeric `skipped: 0` is handled.

Version conflicts refresh and revalidate before one retry. A changed turn is
reported without placing the stale move. Polls and sends are serialized;
leaving a screen ignores late responses. Visible polling uses 1.2 seconds,
hidden polling 15 seconds, and visibility changes reschedule a single timer.
429 respects numeric or HTTP-date `Retry-After`, with one retry. Missing rooms
clear their stored token and display recovery guidance. An opponent idle for
at least 120 seconds can have one turn skipped; existing stones remain and the
opponent retains their seat. An invalid peer state stops polling and preserves
the last checked board.

## Files and validation

| File | Purpose |
|---|---|
| `index.html`, `package.json` | Static entry, dev and test commands |
| `src/logic.js` | Pure placement, win/draw, replay, snapshot validation and undo |
| `src/ai.js` | Bounded, local threat-based computer opponent |
| `src/controller.js` | DOM-free setup, persistence and preview transitions |
| `src/rooms.js` | Injectable fetch client, history validation and online session |
| `src/i18n.js` | Nine complete dictionaries and locale selection |
| `src/app.js`, `src/style.css` | Accessible UI, themes, zoom and persistence |
| `tests/logic.test.mjs` | Directions, edges, overlines, draws, illegal moves, undo and random games |
| `tests/ai.test.mjs` | Immediate wins/blocks, threats, legality and time budget |
| `tests/controller.test.mjs` | Home/play/end, previews, undo, reload and mode isolation |
| `tests/app.test.mjs`, `tests/app-harness.mjs` | App event handlers and markup, first-click/Enter joins, validation, player icons and computer announcements across nine locales, single end-screen control set |
| `tests/presentation.test.mjs` | Wood-backed stone fills, marker contrast and minimum size, wrapping CSS and inline favicon |
| `tests/i18n.test.mjs` | Exact key sets, nonempty translation forms, placeholders, plural rules and locale aliases |
| `tests/rooms.test.mjs`, `tests/fake-server.mjs` | Full games against a rules-agnostic in-memory rooms server, conflicts, invalid moves, skips, retry timing, recovery and races |
| `ASSETS.md` | Asset and licence record |

The shipped HTML/CSS/JS is about **87 KB uncompressed**, below the 150 KB budget.
AI tests check a 300 ms ceiling on representative 15 × 15 positions on the test
machine. The search is bounded; it is a casual opponent, not a tournament
engine or an exhaustive solver. Physical-phone timings have not been measured.
The rooms service enforces its own lifetimes and 2,000-event room limit.

The current suite has 109 passing tests. App tests execute the shipped handlers
with a small DOM double and an in-memory rooms server; presentation tests check
CSS values and contrast, without a layout engine. No live account or production
room is created during tests.

Browser verification remains limited by this execution environment: the sandbox
rejects a local HTTP server's listening socket, and browser policy blocks
`file:` URLs. Native pointer/keyboard behavior, screen-reader speech and the
360 × 640 layout in all nine locales still need a browser check on a served
page; automated event and CSS checks do not establish those visual results.
