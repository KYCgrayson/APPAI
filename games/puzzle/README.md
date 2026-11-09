# River Crossing

An original, low-poly tabletop presentation of public-domain river-crossing puzzles. Three levels, animated primitive characters, synthesized sound, undo, local star scores, and Traditional Chinese / English UI. No runtime network or AI calls.

```sh
npm run dev
npm run build
npm test
```

Vite serves the game locally (normally http://localhost:5173). `dist/` is a self-contained static build using relative asset paths. Nothing needs to be added to the parent Next.js application.

Tap characters or the accessible traveler buttons to board/unboard. Tap the boat or **Set sail** to cross. Drag to orbit, scroll/pinch to zoom. Space sails, Z undoes, R restarts. Undo reverses one boarding or crossing action; after failure it restores the pre-departure state. Undo is disabled after a win.

URL parameters:

- `?locale=zh-TW` (any `zh*` selects Traditional Chinese; other values select English). Without the parameter, uses `navigator.language`.
- `?theme=dark` uses a darker scene and UI.
- `?color=426b58` sets the button accent; accepts exactly six hexadecimal digits, with an optional `#` (URL-encode a hash as `%23`).
- `?debug=1` shows FPS, approximate average frame time, draw calls, triangles, and first rendered frame time.

`window.__puzzleMetrics` updates once a second. `firstFrameMs` is the absolute `performance.now()` timestamp of the first rendered frame. `window.__puzzleTest.state()` returns a cloned state plus screen/animation status. `act({type:'start',level:'easy'})`, `act({type:'toggle',id:'goat'})`, `act({type:'cross'})`, `act({type:'undo'})`, `act({type:'restart'})`, and `act({type:'menu'})` drive the public game flow. Wait until `state().animating === false` after each crossing (800 ms). Passengers stay aboard after landing until toggled off. Repeated animals use IDs `rabbit1`…`rabbit5` and `fox1`…`fox5`.

The pure logic module exports `solution(level)` (concrete passenger lists) and `solve(level)` (minimum crossings). BFS confirms **7 / 11 / 13**. Hard has five rabbits and five foxes, capacity three, and keeps the in-boat balance rule. Only `rabbit1` and `fox1` (wearing captain hats) can row; every crossing needs at least one of them. With all travelers allowed to row, hard takes 11 crossings. Rules are evaluated after landing with docked passengers counted on that bank. Loading itself never triggers a bank failure.

WebGL and a modern browser are required. See ASSETS.md for licenses and MEASUREMENTS.md for verification details.

## Results, sharing, and challenges

The clock starts when a level starts and stops on victory, including sailing time. Undo never rewinds it; restarting starts a new clock. Each completed run is saved to `localStorage['river-runs']`, retaining the best five per level, ordered by crossings, elapsed milliseconds, then completion date. **This leaderboard is personal and per-device until a backend exists.** Storage failures are tolerated.

After winning, tap **分享成績 / Share result** to generate a 1080×1350 PNG from the original 3D scene, result, stars, and personal leaderboard. Supported devices open native file sharing with the challenge URL in the share text. Cancellation is silent. Other environments show a scrollable image preview with download and copy-link actions; clipboard failure selects a read-only URL for manual copying. Preview object URLs are revoked on close. The optional nickname is stored in `river-name` and appears only on the card and challenge link.

Challenge URLs retain only `locale`, `theme`, and `color` from the current page, plus:

- `challenge=easy|medium|hard`
- `c`: integer crossings, from that level’s optimum through 999
- `t`: whole elapsed seconds, 1–86399
- `n`: optional nickname, trimmed and limited to 12 Unicode characters after removing control characters and `<>&"'`

Malformed or duplicate challenge fields invalidate the whole challenge silently. Valid challenges show a menu banner, direct start button, target chip, and victory comparison (fewer crossings wins; equal crossings requires a faster time). Challenge values are user-supplied and are not verified records. No backend, analytics, runtime network, or AI service is used.

`window.__puzzleTest.state()` also returns `elapsedMs` and decoded `challenge`; `act({type:'share'})` runs the share flow after a win. `window.__puzzleShare.lastCardDataUrl` and `.lastUrl` expose the most recently generated PNG and challenge link for browser checks.
