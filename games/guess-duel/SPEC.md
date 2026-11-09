# Guess Duel (猜數字對決) — build spec

A two-player, turn-based deduction game on the public-domain "1A2B / bulls and cows" mechanic, for a parent and a 10-year-old on one phone, iPad or computer (e.g. waiting at a restaurant). Original name and look. Do NOT reference or imitate any commercial game (no Mastermind branding, colored pegs, or look).

Scaffold already exists: `package.json` (Vite 8.3.6, TypeScript 5, runtime dep `qrcode-generator` 2.0.4 MIT), `vite.config.ts` (`base: './'`), `tsconfig.json`, `.gitignore`. Dependencies are installed. Use Node at `~/.local/node-v24.22.2-darwin-arm64/bin` (`export PATH=~/.local/node-v24.22.2-darwin-arm64/bin:$PATH`). No network access is needed or available; do not add dependencies.

Plain DOM + CSS (no Three.js; it adds nothing here). All art is CSS/SVG made in code; all sound is Web Audio synthesized in code. No fonts, images or audio files. No network or AI calls during play, except the optional online-room mode which calls the AppAI rooms API (below).

## Rules (logic module, pure, no DOM)

- Secret: N distinct digits 0–9, N = 3 (default, "kid") or 4 ("challenge"). Leading 0 allowed.
- Guess: N distinct digits. Reply `xAyB`: A = right digit right place, B = right digit wrong place.
- Both players set a secret. Players alternate guessing the OTHER player's secret. First player alternates every rematch.
- Fair ending: if the first player hits NA on their k-th guess, the second player gets their k-th guess too; if they also hit, it's a draw. If only the second player hits on their k-th guess (first player didn't on k-th), second player wins.
- Optional max turns: none.
- Export: `score(secret, guess)`, `isValidCode(code, n)`, `createGame(opts)`, `applyGuess`, `applyReply`, `winner(state)`, all immutable and serializable. The game state must be expressible without either secret (secrets live outside the shared state) so the same reducer drives local, AI, relay and online modes.
- Commitment: when a player sets a secret, publish `commit = SHA-256(hex)(secret + ':' + salt)` with a random 16-byte hex salt (crypto.getRandomValues; crypto.subtle.digest). At game end both reveal `{secret, salt}`; verify the hash and re-check every reply against the revealed secret. A mismatch shows a friendly "答案對不上 / Answers don't match" notice (not an accusation). In local and AI modes the app does this automatically.

## Notes pad (deduction aid)

Each player has a 0–9 digit pad they can tap to cycle: unknown → ruled out (struck, dimmed) → confirmed (highlighted) → unknown. Private per player; in local mode it's hidden behind the hand-over screen with everything else. Guess history shows each guess with its reply as large chips. Optional "hint" toggle (off by default) that greys out digits that are logically impossible given history — compute by checking all candidate codes consistent with history.

## Modes (choose on home screen)

1. **Same device (同一台輪流)** — pass-and-play. Hand-over screen between every turn and during secret setup: full-screen "請把裝置交給 {name} / Pass the device to {name}" with a large "我是 {name}，開始 / I'm {name}, start" button. Nothing private (secret, notes, own history focus) is rendered until that button is pressed. Secret entry: big keypad, entered digits shown as ● with a press-and-hold eye button to peek. After secrets are set, each turn shows: whose turn, own secret (masked, hold to peek), history of both players, keypad to guess.
2. **Vs computer (跟電腦玩)** — solo. Difficulty 簡單/普通: 普通 = guess a random code consistent with all replies so far; 簡單 = with 50% probability a random valid code consistent with only the most recent reply, otherwise consistent with all. Computer secret random. Computer "thinks" ~700 ms with a small animation. No hand-over screen needed.
3. **Relay between devices (換裝置接力)** — each player on their own phone/iPad/computer, no server. Shared state (no secrets) is serialized to the URL fragment `#r=<base64url(JSON)>` (fragment is never sent to a server). Each device keeps its own `{gameId, seat, secret, salt, notes}` in localStorage `guess-duel:relay:{gameId}`. Flow: P1 creates (names, N) → sets secret → gets link; P2 opens link → claims seat 1 (only if the device has no seat for this gameId) → sets secret → makes first guess... Use who-starts from state. When a device opens a link with a pending guess against its own secret, it computes the reply automatically and appends it. After acting, show the share screen: big QR code (qrcode-generator, rendered as SVG or canvas, high contrast, quiet zone), "分享連結 / Share link" (navigator.share with fallback to copy), and the text "換對方用他的裝置掃描或打開連結". Opening an old link (lower `seq` than local) shows "這是舊的連結 / This link is out of date". Opening a link for a seat already taken on a different device shows spectator view without secrets. Keep URLs short (compact keys) so the QR stays scannable (<= ~600 chars for 20 guesses).
4. **Online room (房號連線)** — both devices online, room code. Implement `src/net/rooms.ts` against the AppAI rooms API contract below. Default base `https://appai.info`, override with `?api=<origin>` (must be http(s); for local testing). The home screen shows this mode; if create/join fails with 503 `unavailable`, network error, or CORS failure, show "連線對戰還沒開放，先用其他模式玩吧 / Online rooms aren't available yet" and stay on home. Same reducer as relay; transport is the room `state` (shared, no secrets) + `move` messages.
   - create: host chooses names/N, `POST /api/rooms {game:"guess-duel", seats:2, state, turn:0}` → shows 6-char code big, plus QR of a join link `?room=CODE`. Guest enters code (6 big input boxes, case-insensitive, ignore spaces/dashes, charset `ABCDEFGHJKMNPQRSTUVWXYZ23456789`) or opens the link.
   - Each player sets secret locally, sends move `{t:"commit", h}`.
   - Guess: move `{t:"guess", g}` with `nextTurn` = opponent. The opponent's device, on seeing a guess against its secret, auto-sends move `{t:"reply", r:"1A2B"}` (turn stays with it), then that player guesses.
   - End: send `{t:"reveal", s, salt}` moves, `end:true` after both reveals or when the winner is decided and own reveal sent.
   - Poll every 1.2 s while visible, every 15 s while hidden. Process ALL moves with `version > since` from `room.moves`, not only `lastMove`. Show "{name} 斷線中" when opponent `online` is false. If the turn holder's `idleSeconds >= 120`, offer "跳過他這一回合" which sends `{version, skip:true}`.
   - 409 version_conflict → refetch and retry once. 404 → clear `room:{code}` token from localStorage, back to home with message. 429 → honor `Retry-After`.
   - Store `{token, seat}` in localStorage `room:{CODE}` so reload rejoins.

### Rooms API contract (v3, from AppAI PR #48 — not deployed yet)

| fn | HTTP | body | response |
|---|---|---|---|
| create | `POST /api/rooms` | `{game, seats:2, state?, turn?}` | `201 {code, seat:0, token, room}` |
| join | `POST /api/rooms/{code}/join` | `{}` | `200 {seat, token, room}`; `409 room_full` |
| poll | `GET /api/rooms/{code}?since=v` + `Authorization: Bearer token` | — | changed: `{changed:true, seat, room}`; else `{changed:false, version, seats}` |
| sendMove | `POST /api/rooms/{code}/moves` + Bearer | `{version, move, state, nextTurn?, end?}` | `200 {room}`; `409 version_conflict` / `not_your_turn` (with latest `room`) |
| skip | same endpoint | `{version, skip:true, move?}` | turn goes to next seat; only when turn holder idle >= 120 s |

`room = {code, game, version, state, turn, seats:[{seat, joined, online, idleSeconds}], moves:[{version, seat, move, skipped?}] (last 20), lastMove, status: waiting|playing|finished, expiresAt}`. Errors `{error, message}`: invalid_request, state_too_large (state ≤ 8 KB, move ≤ 1 KB), room_not_found (also for a bad token), room_full, unauthorized, version_conflict, not_your_turn, room_finished, rate_limited, origin_not_allowed, unavailable (503). Rooms fill → `playing`; unfilled rooms expire after 30 min; full rooms 24 h, or close after 15 min with no polling. Server does not validate game rules — the client must validate incoming moves with the reducer and ignore invalid ones.

## Screens and UX

- Home: title 猜數字對決 / Guess Duel, mode buttons (4), "怎麼玩 / How to play", settings (digits 3/4, sound on/off, language). Name fields for two players (defaults 爸爸 / 小朋友 in zh-TW, "Player 1"/"Player 2" in en; stored in localStorage).
- Rules screen: 4 short steps with a worked example: secret 4 2 7, guess 7 2 4 → 1A2B (2 is right place; 4 and 7 are in the code but wrong place). Animated chips. Reachable from home and from an in-game "?" button.
- Scoreboard: per name pair, wins for each and draws, `localStorage['guess-duel-scores']`, shown on home and on result screen, with "清除 / Reset" (confirm). Vs-computer has its own row.
- Result screen: winner celebration (CSS confetti made in code, no images), both secrets revealed, number of guesses each, verification result, "再來一局 / Rematch" (same names/mode/N, swaps who starts), "回首頁 / Home". In relay/online mode rematch creates a new game and shares a new link / keeps the room only if the API allows (otherwise new room).
- Big tap targets: keypad keys ≥ 64 px on phones, all buttons ≥ 48 px. One-handed friendly: keypad at the bottom. Works in portrait and landscape at 375×667, 390×844, 768×1024, 820×1180, 1024×1366, 1366×1024, 1440×900. On wide screens show both players' histories side by side; on narrow screens, own history first with a toggle for opponent's.
- Desktop: keyboard digits, Backspace, Enter.
- Warm, friendly palette (no violence imagery). Two player colors (e.g. teal and coral) with distinct shapes too (not color-only). Respect `prefers-reduced-motion`. `?theme=dark`, `?color=RRGGBB` accent, `?locale=zh-TW|en` (any zh* → zh-TW; default from navigator.language) like the sibling game.
- Accessibility: buttons are real `<button>`s with labels; the reply is announced via an aria-live region.
- Sounds (Web Audio, synthesized): key tap, submit, per-A ping and per-B soft chime when a reply shows, win flourish. Sound toggle remembered in localStorage. Audio starts only after a user gesture.
- Never show the secret of the other player before the end, in any mode (including in DOM/aria text). The local mode's secrets live only in memory (not localStorage) and are cleared on Home.

## Code layout

```
src/logic/game.ts      pure rules/reducer, scoring, candidates, AI
src/logic/commit.ts    commit/verify (WebCrypto)
src/relay/codec.ts     compact URL fragment encode/decode + validation
src/net/rooms.ts       rooms API client (fetch injected for tests)
src/net/online.ts      online session driver (polling loop, move processing)
src/ui/i18n.ts         zh-TW / en strings
src/ui/audio.ts        Web Audio
src/ui/*.ts            screens
src/ui/style.css
src/main.ts
index.html
```

Test hooks: `window.__duelTest = { state(), act(action) }` where state returns a clone of mode/screen/game state (never the other player's secret unless the game is over; local mode may expose secrets only with `?debug=1`), and act drives: `{type:'mode',mode}`, `{type:'setSecret',code}`, `{type:'handover'}`, `{type:'guess',code}`, `{type:'rematch'}`, `{type:'home'}`.

## Tests (node --test, `tests/*.test.ts`, no DOM)

- score() incl. 0A0B, all-B, NA, 3 and 4 digits; validation (repeats, length, non-digits).
- reducer: alternation, fair-ending (first hits → second gets a last guess; draw; second-only hit), cannot guess out of turn, immutability.
- candidates/consistency; AI 普通 always solves 3-digit within 10 guesses and 4-digit within 10 across 200 seeded random secrets (seeded RNG injectable); report average.
- commit/verify round-trip and mismatch detection (node has `crypto.subtle`).
- relay codec: round-trip, size budget for 20 guesses, rejects malformed/tampered/oversized input, never contains secrets.
- rooms client with a mocked fetch: create/join/poll/sendMove/skip request shapes, Bearer header, 404 clears token, 409 retry, 429 backoff, processing multiple moves between polls, ignoring invalid moves.
- scoreboard storage tolerant of broken localStorage (inject a fake storage).

## Docs to write (same style as ../puzzle in branch claude/puzzle-games-c81177: concise)

- README.md: what it is, commands, modes, URL params, test hooks, privacy (no network except optional rooms API; relay uses URL fragment).
- ASSETS.md: table of every asset/dependency with origin and license (qrcode-generator MIT, Vite MIT, TypeScript Apache-2.0, procedural art/audio original, system fonts, public-domain 1A2B mechanic).
- MEASUREMENTS.md: build sizes (raw and gzip via Node zlib), test counts, AI average guesses. Leave a "Browser checks" section header that the reviewer will fill.

Done = `npm test` passes and `npm run build` passes. Do not commit, push, or deploy. Delete SPEC.md? No — keep it.

## Rooms API v4 changes (supersede the contract above where they differ)

- Hosting: the game will be served from appai.info itself (same origin as the API), e.g. `https://appai.info/games/guess-duel/`, because creating a room needs the appai.info sign-in cookie (Safari blocks it cross-site). Default API base: same origin (relative `/api/rooms`) when `location.hostname` is `appai.info` or `www.appai.info`; otherwise `https://appai.info`; `?api=` still overrides for local testing. Send `credentials: 'include'` on create.
- Create needs sign-in: `401 login_required` → show "建房要先登入 AppAI（加入不用）/ Sign in to AppAI to create a room (joining doesn't need it)" with a button to `/login?callbackUrl=<current path+search>` on the API origin (top-level navigation: use `window.top.location` if allowed, else open in a new tab). Joining and playing need no sign-in.
- New `POST /api/rooms/{code}/start` + Bearer (seat 0 only; `403 not_host`; needs ≥ 2 joined). For this 2-seat game the room auto-starts when the second player joins; implement `start()` in the client anyway (tested), not needed in the UI.
- An unstarted room closes 2 minutes after creation or the latest join. Show the host a countdown "2:00 內請對方輸入房號" and, on expiry/404, a "重新開房 / New room" button.
- Extra error codes: `room_not_ready` (409), `not_host` (403). The documented hidden-info pattern matches ours (guess → reply moves, `sha256(answer+salt)` commitment, reveal at end).
