# Sea Battle — sink the fleet

A standalone, offline coordinate guessing game in plain HTML, CSS and ES modules.
No build step, npm dependencies, sign-in, analytics, remote fonts or network calls.

## Run

```sh
export PATH="$HOME/.local/node-v24.22.2-darwin-arm64/bin:$PATH"
cd games/sea-battle
npm run dev   # python3 -m http.server 5185
# Open http://localhost:5185/
npm test      # node --test tests/*.test.mjs
```

The directory follows the repository's static-game convention. Its entry has the
exact charset marker needed for base-path insertion when copied by the existing
sync script. Catalog registration and changes to that script are outside this unit.

## Rules and modes

This implements the classic paper-and-pencil fleet-hunting variant:

- Classic sea: 10 × 10, columns A–J and rows 1–10. Five straight ships of
  lengths 5, 4, 3, 3 and 2 occupy 17 cells.
- Small sea for younger players: 8 × 8, A–H and 1–8. Four ships of lengths
  4, 3, 3 and 2 occupy 12 cells.
- Ships never overlap or leave the grid. By default they cannot touch, including
  diagonally. Turn on **Ships can touch** to allow adjacent ships.
- Each player fires at one previously untried coordinate, then the turn passes,
  even on a hit. **Hit = shoot again** grants another shot for hits and sinks.
- Results are miss, hit, or sunk. A sunk result identifies only the ship's size.
  Find every enemy ship cell to win.
- Select a ship, tap its starting cell, rotate if needed, and confirm placement.
  Select a placed ship to move it. Random fleet and Clear fleet are also available.
- **Computer:** easy chooses random untried cells; normal follows orthogonal
  neighbors of unresolved hits; hard scores possible remaining ship placements,
  follows hit lines and uses the no-touch rule when enabled. All levels receive
  only public shot results and generic fleet lengths, never the hidden fleet.
- **Two players on one device:** both players place privately. A privacy screen
  precedes each player's setup and every turn change. The shooter reads their own
  result before passing the device. Extra-shot turns stay with the same player.
  A 550 ms reveal guard prevents a quick double tap from opening the next screen.
- Home includes settings, rules and a resume button. The result screen offers
  play again and home. Replacing an unfinished game asks for confirmation.

## Language, appearance and access

All UI copy is supplied in en, es, zh-TW, zh-CN, ja, ko, de, fr and hi (Devanagari).
`?lang=<code>` takes priority; otherwise the preferred supported language in
`navigator.languages` is matched exactly, then by primary language. Traditional
Chinese includes zh-Hant, zh-HK and zh-MO; other Chinese variants use zh-CN.
The default is English. The language picker updates `?lang=`, the document language
and page title without reloading. Language choice is recorded with the save;
removing the query parameter explicitly restores browser-language detection.

Automatic appearance follows `prefers-color-scheme`. Manual light and dark choices
are saved. Symbols distinguish ship, miss, hit, sunk and aimed cells, alongside
translated accessible names; text does not depend on color alone. Turn changes and
results are announced through a persistent polite live region.

At 360 × 640, sea cells are approximately 27–35 CSS px because 8–10 columns plus
coordinates cannot fit at 44 px each. **Tapping a cell only aims**: a separate
44+ px placement or Fire button confirms the action. Other controls have 44+ px
targets. The page scrolls vertically. On phones, tabs switch between own fleet and
target sea; desktop shows both, with the target larger. Safe-area padding is used.

Keyboard: Tab into a sea; arrow keys move among coordinates (Home/End move to row
edges). Enter or Space selects a cell. Tab to the confirmation button and activate
it to place or fire. Each sea has one tab stop. All other controls use native
button, select and checkbox behavior.

## Saves and privacy

Settings and the in-progress game use the versioned `sea-battle:v1` localStorage
key. A move log is replayed through the rules engine on reload, reconstructing shot
results. Partial fleets are also validated. Invalid saves start fresh. Reload and
Resume in two-player mode always show a handoff before any private board.
Home preferences for a new game do not change an existing session's rules or mode.
If storage is unavailable, a translated notice explains that the page must stay open.

Hidden fleets live on this device. Handoff screens protect against casual peeking;
they do not protect against someone inspecting localStorage or developer tools.
Both players should trust each other and keep the screen private.

No rooms API is included. Online hidden fleets would need a commitment scheme
and private-state protocol; that is a possible later addition. Rooms clients,
network error handling and fake-server tests are therefore not applicable.

## Verification

The 58 passing tests cover placement bounds, overlap and touching; 1,000 random placements
for **each** size/touch combination (4,000 total); miss/hit/sunk/win; alternate and
extra-shot turns; 100 complete rules games; AI bounds and non-repetition; normal
follow-up; complete controller games; reload privacy; settings isolation; corrupt
saves; locale keys, placeholders and Chinese matching; and all five screen types
rendered in all nine languages using a tiny Node document stub, without a browser.

The deterministic AI benchmark runs 200 paired classic, no-touch games with
Mulberry32 seeds 1–200 for fleets and seed + 1000 for each AI's choices:

| Level | Average shots to find the whole fleet |
|---|---:|
| Easy | 95.150 |
| Normal | 65.680 |
| Hard | 38.645 |

AI choices in the local Node run stayed below 1 ms. The benchmark checks a 300 ms
regression ceiling; actual phone timing still needs browser/device verification.
The HTML and six source files ship at 74,598 bytes uncompressed, below
150 KB. There are no image or word-list downloads.

The requested `python3 -m http.server 5185 --bind 127.0.0.1` smoke check was
attempted, but the execution sandbox denied the socket bind (`PermissionError`).
As a fallback, Python's actual `SimpleHTTPRequestHandler` was exercised with
in-memory HTTP requests: the nested `/games/sea-battle/?lang=hi` entry, stylesheet
and all five ES modules returned HTTP 200 (seven responses). Relative asset paths
also resolved. This does not replace a live server fetch or browser verification.
No real browser was used; 360 px layout, screen-reader behavior and physical-device
timing remain manual verifier checks. Calculated text contrast for the palette
pairs is at least 5.69:1 in light mode and 6.87:1 in dark mode.

## Files

| Path | Purpose |
|---|---|
| `index.html`, `package.json` | Static entry, development and test commands |
| `src/logic.js` | Pure fleet placement, shot resolution and turn rules |
| `src/ai.js` | Three local AI levels with injected random source |
| `src/controller.js` | Pure screen transitions, privacy, save validation and replay |
| `src/i18n.js` | Nine complete dictionaries and language matching |
| `src/app.js`, `src/style.css` | Accessible responsive UI and appearance settings |
| `tests/*.test.mjs`, `tests/helpers.mjs` | Rules, AI, controller, locale and rendering checks |
| `ASSETS.md` | Original asset and licence record |
