# Snakes and Ladders

A small, dependency-free version of the traditional Indian race game Moksha
Patam. Plain HTML, CSS, and ES modules; no build step, fonts, images, analytics,
or third-party packages. Original SVG snakes, wooden ladders, and geometric
tokens are drawn in code. Shipped `index.html` plus `src/` is about 85 KB
uncompressed, below the 150 KB limit.

## Run

```sh
export PATH="$HOME/.local/node-v24.22.2-darwin-arm64/bin:$PATH"
cd games/snakes-and-ladders
npm run dev  # python3 -m http.server 5184
# Open http://localhost:5184/
npm test    # node --test tests/*.test.mjs
```

The source is ready for the repository's **static** sync convention: the charset
tag is exactly `<meta charset="utf-8">`, and all game resources use relative
paths. The catalog and sync-script registration are intentionally left for the
separate integration step. The only site link is `/games` on Home, plus the
AppAI sign-in link when room creation needs authentication.

## Rules and modes

- Two to four tokens start **off the board at 0**. No six is needed to enter.
  Roll one die and move that many numbered squares. A roll of one reaches 1.
- The classic board has 100 squares, 10 columns and 10 alternating-direction
  rows (boustrophedon). The short board has 50 squares in 10 columns and 5 rows.
- The classic layout has eight ladders and eight snakes; the short layout has
  five of each, in separate columns spanning at least two rows. Short-board
  artwork stays to the right of number badges. Land at a ladder's bottom to
  climb or a snake's head to slide.
  Passing over a connection does nothing. The engine supports chained
  connections and rejects cycles; the fixed layouts do not have chains.
- **Exact roll to finish: ON by default.** Overshooting bounces back: from 98,
  a four moves 99 → 100 → 99 → 98. Reaching 100 during a bounce does not win.
  A connection on the final landing square still applies. On the short board
  the same rule uses 50. With exact finish OFF, reaching or passing the finish
  wins, and the token stops at the finish.
- **Roll six to roll again: OFF by default.** When enabled, six keeps the turn
  after movement and any snake or ladder. A win ends the game immediately.
- The first token to the finish wins. There is no turn cap in local play.
- **On this device:** each of 2–4 seats can be Human or Computer, in any mixture,
  including four computers. Pass the device between human turns. Computers
  simply roll after 650 ms (300 ms with reduced motion), with no search.
- **Room with friends:** each friend has one human seat on their own device.
  Choose a capacity of 2–4. A full room starts automatically; the host can start
  early with two or more joined seats. Empty seats are removed consistently.
  Room settings come from the creator; joining uses those settings.

## Language, display and access

Complete UI text in en, es, zh-TW, zh-CN, ja, ko, de, fr, and hi. A valid `?lang=`
selects the language; otherwise `navigator.languages` is matched in order by
exact tag then primary subtag, defaulting to English. Chinese Hant/TW/HK/MO use
Traditional Chinese; other Chinese tags use Simplified Chinese. The language
picker updates `?lang=`, `<html lang>`, and the page title. Native language names
in the picker are intentional. Hindi copy uses Devanagari.

Automatic appearance follows `prefers-color-scheme`; Settings also offers saved
Light and Dark choices. Main text, muted text, and button text palettes were
checked for WCAG AA contrast. Token color is supplemented by circle, triangle,
square or diamond shapes **and** seat numbers, with a text position list below.

The board scales to the screen at 360×640; desktop uses a centered two-column
layout up to 1160 px. The page may scroll vertically. Board squares are smaller
than 44 px on phones, are **not interactive**, and have an **Enlarge board**
control for a horizontally scrollable larger view (Fit board reverses it).
Other controls have at least 44 px hit areas; checkbox labels are full-row hit
areas. Safe-area insets are respected.

Use Tab/Shift+Tab and Enter/Space for native controls. Space also rolls when
focus is outside a control and it is your human turn. The enlarged board can be
focused and scrolled with the keyboard. Turn changes, rolls and winners use a
persistent polite live region. Token movement follows every numbered step,
then climbs/slides. `prefers-reduced-motion` skips the movement animation.

## Saving and rooms API

Settings and local progress use the versioned key `snakes-and-ladders:v1`.
Reload resumes an active local game or reconnects an active room. Home pauses a
local game and stops room polling; Resume continues it. New game returns to
setup without erasing the resumable local game until a new one is started.
Play again starts a new local game, or returns to room setup after an online
game. If storage is blocked or full, a translated warning explains that reload
cannot reliably preserve play. Tokens never appear in URLs.

The only network traffic is explicit online play via `/api/rooms` on
`https://appai.info` (the current AppAI origin is used when hosted there).
Creation uses the signed-in cookie and needs the game served from appai.info.
401, 403 and network failures during creation show translated sign-in guidance
and `https://appai.info/api/auth/signin`, mirroring Guess Duel's guidance.
Joining and playing do not need sign-in; allowed deployment origins are managed
by the platform. `?room=ABC234` pre-fills the Join field; joining takes a click.
No token, API key or custom API origin is accepted from the URL.

The injected-fetch client implements create, join, poll, start, roll, and idle
skip. Polls run every 1200 ms while visible and 15000 ms while hidden; visibility
changes reschedule polling. HTTP 429 waits for Retry-After (seconds or date),
then retries once. Version conflicts and not-your-turn responses synchronize
the latest validated board and ask the player to review it before rolling
again. A missing room clears its stored credentials. After an opponent has
been idle for at least 120 seconds, another player may skip their turn; the
returning player keeps the seat. Waiting rooms expire two minutes after the
latest join; other lifetime and rate limits are controlled by the rooms API.

Credentials and verified checkpoints use per-room keys:
`snakes-and-ladders:v1:room:<API origin>/<CODE>`. The checkpoint holds a validated
rules state and transport version. Every received move is replayed through the
same reducer, and peer state snapshots and turn/winner claims must match that
replay. Skip records use the API's numeric skipped-seat field, including zero.
Longer-than-20-move gaps cannot be verified because the API retains only 20
moves; the client fails closed with a translated request to start a new room.
This is a deliberate recovery limit, avoiding acceptance of unverified peer
state. Saved checkpoints allow ordinary reload and reconnection.

**Room dice are trusted client-side rolls.** Crypto randomness with rejection
sampling produces the die; the roller sends `{roll: 1..6}` with the resulting
state. Peers reject illegal rolls and rule changes, but cannot prove that
another player did not choose a legal roll. This is casual play, with no wagers
or competitive anti-cheat. The platform also caps rooms at 2000 moves.

## Files and validation

| File | Purpose |
|---|---|
| `index.html` | Static entry and live announcement region |
| `src/logic.js` | Pure board mapping, travel, connections, turns, validation |
| `src/ai.js` | Crypto die and computer roll decisions |
| `src/controller.js` | Save restoration, roll eligibility, animation route |
| `src/rooms.js` | Injectable rooms transport and checkpoint/replay session |
| `src/i18n.js` | Complete phrases, locale matching and interpolation |
| `src/art.js` | Original SVG board, snakes, ladders, tokens, home illustration |
| `src/app.js` | Screens, keyboard, animation, settings and persistence |
| `src/style.css` | Responsive light/dark styles and reduced motion |
| `tests/logic.test.mjs` | Rules, geometry, bounce, chains and validation |
| `tests/ai.test.mjs` | Die boundaries, computer behavior, 400 full games |
| `tests/i18n.test.mjs` | All nine key sets, nonempty values, placeholders, matching |
| `tests/app.test.mjs` | Controller and actual app-entry/event flows in a tiny DOM-free shell |
| `tests/art.test.mjs` | Short-board artwork clearance from numbers and other connections |
| `tests/fake-server.mjs` | In-memory rooms API, without server-side rules checks |
| `tests/rooms.test.mjs` | Full rooms game, retries, races, skips, replay, reload |

Validation: **68 tests pass**, including 400 full four-computer games, a
complete four-player game against the fake rooms server, room-code blur and
native form submission handlers, setup input persistence, and board clearance.

No browser was used during implementation. Tests exercise actual UI event
handlers in a lightweight shell, not browser layout or real assistive software.
The requested `python3 -m http.server 5184 --bind 127.0.0.1` smoke launch was
attempted, but this execution sandbox denied TCP binding (`PermissionError:
Operation not permitted`). As a fallback, Python's actual
`SimpleHTTPRequestHandler` served GET requests over local socket pairs: HTML,
all seven JS modules, and CSS returned HTTP 200 with byte-identical bodies.
A listening-port/browser smoke check and live AppAI authentication remain for
integration verification outside this sandbox and on an allowed origin.
