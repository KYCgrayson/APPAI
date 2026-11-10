# Race Home

An original, family-friendly dice race in the Ludo/Pachisi family. Plain static
HTML, CSS and ES modules: no build, dependencies, remote art, fonts, or analytics.

## Run

```sh
export PATH="$HOME/.local/node-v24.22.2-darwin-arm64/bin:$PATH"
npm run dev  # python3 -m http.server 5182
# Open http://localhost:5182/
npm test     # node --test tests/*.test.mjs
```

The entry point contains the exact `<meta charset="utf-8">` marker expected by
the repository's `static` game sync. All relative assets also work below
`/games/race-home/`. Registration in the sync script and catalog is deliberately
left to the separate integration step; this change touches only this folder.

## Variant and rules

- 2–4 seats. Quick play defaults to **2 tokens each**; full play uses **4**.
- The cross-shaped shared track has **52 squares**, followed by each player's
  **5-square private home column** and a final home. Positions in the engine are
  `-1` (yard), `0..51` (track), `52..56` (column), `57` (home).
- A 6 brings a token from the yard onto its start. It gives another roll.
  Three consecutive 6s forfeit the third roll before moving; earlier moves stay.
  This rule defaults ON and can be disabled.
- Landing on a lone opposing token on an unsafe square sends it to its yard.
  Capture bonus defaults ON. A capture and a 6 together grant one extra roll.
  Rolling a non-6 resets the consecutive-six count, including during bonuses.
- All four starts and four marked star squares are safe, including unused
  starts. Any players may share them; nobody is captured there.
- Own tokens may stack. Two or more tokens of one opponent block **landing** on
  an unsafe square, but can be passed. This is an explicitly chosen house rule.
- An exact roll is needed to reach home. Home tokens cannot move. If there are
  no legal moves, a short notice precedes the next action; the turn passes even
  if the die was 6. This also prevents a blocked player keeping a bonus forever.
- A single legal choice still needs a tap by default. Auto-move is optional.
- First player with every token home wins. Play stops immediately; the results
  table orders everyone by tokens home. Equal counts share the same progress
  and are displayed in seat order; no extra finishing places are invented.
- Two-player games use opposite starts; three and four players use successive
  arms. Players are identified by **circle, square, triangle, star** and color.

## Modes and controls

- **Same device:** 2–4 human/computer seats, with at least one human. Pass the
  device when the named turn changes. Computer actions pause 750 ms so children
  can follow. Die animation lasts 650 ms; no-move notices pause for 850 ms.
- **Computer:** prefers capture, reaching home, leaving the yard, escaping an
  opponent within six squares, then advancing the furthest token. It performs
  no search and uses only legal moves. Tests time the heuristic, and complete
  32 seeded four-computer quick/full games under varied bonus rules.
- **Room code:** 2–4 devices, all seats human. Seat 0 chooses quick/full and rules
  before creating. The room starts when full, or the host starts with at least
  two joined players. Unfilled seats are removed. Each player rolls and chooses
  on their own device. Open `?room=ABC234` to join or recover a saved seat.
- The die is a 76×76 px button. The small board is a **noninteractive map**, with
  cells smaller than 44 px at phone widths. Token-choice buttons below it are
  at least 70 px high: selecting one is the explicit, unambiguous move. No tiny
  cell needs tapping or keyboard focus. Expand player summaries for every token's
  text location. Tab and Enter/Space operate all controls; keyboard rolls move
  focus to a legal token, and turn/results are announced in an aria-live region.
- Layout is fluid at 360×640 with vertical scrolling, safe-area padding, and a
  larger centered desktop board. Language and theme remain available in play.

## Languages and settings

Complete en, es, zh-TW, zh-CN, ja, ko, de, fr, hi dictionaries; no English
fallback strings. `?lang=` wins, then `navigator.languages` exact matches and
primary-subtag matches, then English. Traditional Chinese scripts/regions
(`zh-Hant`, `zh-HK`, `zh-MO`, `zh-TW`) map to zh-TW; other Chinese maps to zh-CN.
The picker updates `?lang=`, `<html lang>` and the page title.

Automatic/light/dark themes follow the OS by default; manual preference is saved.
Optional generated Web Audio tones default OFF. Settings and the in-progress
local game use **`race-home:v1`**. Reload resumes a local game, including a rolled
die awaiting selection. Home offers Resume and New game. Online play keeps the
local game separately. Private-mode/storage restrictions may prevent persistence.

## Room transport and limits

Only the rooms API at `https://appai.info/api/rooms` is called. Creating requires
the game to be served from **appai.info** and the host to sign in there. A create
401/403 or network failure shows translated sign-in/open-on-AppAI links. Joining
needs no account but the API's origin restrictions still apply; localhost is for
local play and fake-server testing. Production room play has not been exercised
against live accounts as part of this implementation.

Roll results are generated with `crypto.getRandomValues` and rejection sampling,
then included in a separate roll move. **Rolls are client-side and trusted**,
which is suitable for family play, not competitive or money-based play.

Seat tokens are saved separately per room and API origin under
`race-home:v1:room:<origin>/<code>`; they never go in URLs. Polling is every 1.2 s
visible / 15 s hidden, with presence updates and a skip offer after 120 s idle.
Skips preserve tokens and clear the skipped player's pending die and bonus count.
`Retry-After` is honored on 429 before one retry. Version conflicts and
not-your-turn responses refresh the room and ask for a fresh choice, rather than
replaying an old action. A 404 clears the stored token and offers a new room.

Every received action is run through the pure engine. Checkpoints contain the
latest action and its prior state so returning clients can also validate that
transition. The API retains only 20 moves: a longer disconnect recovers from the
validated checkpoint, replays trailing skips, and uses the API turn if earlier
skips have fallen out of the window. As with all public-state rooms, that
checkpoint is a trust boundary: no server-side anti-cheat or full-history proof.

The default ends at the first winner; continuing to rank every finisher is not
implemented (optional in the brief). There is no dedicated pause or room-leave
endpoint; Home stops this device's polling, and other players may skip it once
idle. The API controls room expiry. No live browser was used here. Starting
`python3 -m http.server 5182` was attempted, but this environment denied the
listening socket (`PermissionError: Operation not permitted`), so the requested
HTTP fetch could not be completed. Engine/controller tests, static integrity
checks and a dependency-free UI host test provide the available smoke checks.
HTTP and real-browser visual/play-through verification remain with the verifier.

## Files

| Path | Purpose |
|---|---|
| `index.html`, `package.json` | Static entry point and dependency-free scripts |
| `src/logic.js`, `src/ai.js` | Pure engine, validation, crypto die, computer heuristic |
| `src/rooms.js` | Injectable transport, checkpoint replay, session and polling |
| `src/controller.js` | Save/restore and automatic-action decisions |
| `src/i18n.js` | All nine dictionaries and locale resolution |
| `src/board.js`, `src/style.css` | Original SVG map, responsive themes and die animation |
| `src/app.js` | Home/setup, play, results and room lobby UI |
| `tests/*.test.mjs` | Rules, AI, i18n, controller, UI wiring and rooms regressions |
| `tests/fake-server.mjs` | In-memory rooms server, with no game-rule validation |
| `ASSETS.md` | Provenance and license record |
