# Guess Duel · 猜數字對決

A friendly two-player deduction game for families. Choose three or four distinct digits (leading zero allowed), then take turns guessing. A means correct digit and position; B means correct digit in another position. Both players receive the same final chance.

## Run

Use Node 24 (available here at `~/.local/node-v24.22.2-darwin-arm64/bin`). No new dependencies or network access are required.

```sh
export PATH=~/.local/node-v24.22.2-darwin-arm64/bin:$PATH
npm run dev
npm test
npm run build
npm run preview
```

Optional viewport regressions use an existing Playwright installation and browser, without
adding dependencies or contacting a server:

```sh
npm run build
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/browser-round5.mjs
# Add BROWSER_ENGINE=webkit for an installed Playwright WebKit browser.
```

This checks both languages, both code lengths and all nine target viewports using the built
assets. It verifies the selected phone history, empty hints, newest visible entry, stable
keypad positions, tap target sizes and horizontal overflow.

## Modes

- **Same device:** masked secret entry and a privacy curtain between setup and every turn. Secrets stay in memory and are cleared on Home.
- **Vs computer:** easy or normal deduction. Normal chooses randomly from every code consistent with its replies; easy sometimes uses only the latest reply.
- **Relay:** share a QR/link after acting. Open each new link on the other player's own device. The fragment carries compact public state; each device stores only its own secret, salt, notes and latest sequence. Old links are flagged; devices without a seat see a spectator view once seats are committed. At the end, share again to exchange reveals and complete verification.
- **Online room:** create or join with a six-character code. The AppAI rooms v4 API is optional and may not yet be deployed. Creating needs AppAI sign-in; joining does not. Hosts have two minutes to invite a guest. Unavailable/network/CORS failures return a friendly notice. The client has mocked transport tests; no live service was needed for development.

Digit notes cycle unknown → ruled out → confirmed. Logical hints are off by default. Desktop controls: digits, Backspace, Enter. Hold the eye button (pointer, Space or Enter) to peek at your own secret. The rules remain available via `?`.

## URL options

| Option                          | Meaning                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `?theme=dark`                   | Dark palette                                               |
| `?color=RRGGBB`                 | Accent color                                               |
| `?locale=zh-TW` or `?locale=en` | Language; any `zh*` selects Traditional Chinese            |
| `?api=http(s)://origin`         | Rooms API origin override                                  |
| `?room=CODE`                    | Join or resume a room                                      |
| `?debug=1`                      | Allow local-mode secrets in the test hook                  |
| `#r=…`                          | Relay public state; the fragment is never sent to a server |

## Test hook

`window.__duelTest.state()` returns a clone of mode, screen, seat and shared game state. Other players' secrets are unavailable until the result; local-mode private data is available only with `?debug=1`.

`await window.__duelTest.act(action)` accepts:

```js
{ type: 'mode', mode: 'same' } // same | ai | relay | online
{ type: 'setSecret', code: '012' }
{ type: 'handover' }
{ type: 'guess', code: '345' }
{ type: 'rematch' }
{ type: 'home' }
```

## Privacy and verification

There are no analytics, remote assets, fonts, AI calls or play-time network requests except the explicitly selected rooms mode. Procedural audio starts after a user gesture. Relay links use the URL fragment and include no unrevealed secrets. Online state and moves likewise carry commitments rather than unrevealed secrets. End-of-game reveals contain the secrets and salts, permitting SHA-256 commitment checks and a fresh check of every reply. A mismatch displays “Answers don't match / 答案對不上”.

Names/settings, sound, language and scores use localStorage. Relay uses `guess-duel:relay:{gameId}`, online credentials use `room:{CODE}`, and online private data uses `guess-duel:online:{CODE}`. Blocked storage falls back to memory. Private relay/online entries expire after two days. Clearing browser storage loses device seats/secrets. Do not share a device's browser storage with the opponent. Rematches start a new game, swap the first player, and use a new relay link or online room.
