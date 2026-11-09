# River Crossing

An original, low-poly tabletop presentation of public-domain river-crossing puzzles. Three levels, animated primitive characters, synthesized sound, undo, local star scores, and Traditional Chinese / English UI. No runtime network or AI calls.

```sh
npm run dev
npm run build
npm test
```

Vite serves the game locally (normally http://localhost:5173). `dist/` is a self-contained static build using relative asset paths. Nothing needs to be added to the parent Next.js application.

Use the house icon **首頁 / Home** at the far left of the level header to return to level selection. It is disabled during sailing; fail/win sheets also offer **回首頁 / Home**. Tap characters or the accessible traveler buttons to board/unboard. Tap the boat or **Set sail** to cross. Drag to orbit, scroll/pinch to zoom. Space sails, Z undoes, R restarts. Undo reverses one boarding or crossing action; after failure it restores the pre-departure state. Undo is disabled after a win.

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

## Round 7: a richer procedural diorama

Travelers are original rounded wooden/felt toys with highlighted eyes, cheeks, blinking, breathing, moving ears/tails, boarding hops and victory hops. Farmer clothing, wool, layered cabbage leaves, animal markings and peaked captain caps are built from geometry, with decorative pieces baked into vertex-colored meshes.

The tabletop now has bevelled banks with soil strata and sandy shores, shader-driven water waves and sparkle, foam, a sailing wake, docks, reeds, flowers, pebbles, bushes, varied trees, signposts and flying butterflies. Dusk (`?theme=dark`) adds warm lanterns and animated fireflies. ACES lighting uses one tightly framed soft shadow light; a first-two-second FPS check disables shadow mapping and reduces pixel ratio below 45 FPS. Repeated props use instancing or merged geometry; picking still uses the separate traveler hitboxes and boat only.

**Music** and **Sound effects** are independent, at least 44×44 px buttons (繁中：**音樂 開/關**、**音效 開/關**). Both default on and remember changes locally when storage is available. Music begins after a pointer or keyboard gesture, pauses with a hidden tab and resumes on return. Web Audio generates an 84 BPM, 16-bar pentatonic pad/melody/plucked-bass progression with changing phrases, a victory flourish, and layered wooden, splash, landing and chime effects. Gain ramps avoid abrupt toggle clicks. Nothing is downloaded for the art or sound, and no runtime network or AI calls are introduced.


## Round 10: Home and the landscape

The Home button pairs an original inline house icon with a localized label, with a minimum 44×44 px target. The level title stays immediately beside it; the toolbar contains Undo, Restart and Rules. Phone and tablet layouts reserve a separate row for the music / SFX / reset-view cluster. The menu includes **← 遊戲介紹 / ← About this game**, opening `https://appai.info/p/river-crossing` with `target="_top"`. The link is hidden inside any iframe, including when frame detection throws. The game uses `locale`, so the About URL stays plain.

A Three.js full-screen sky shader paints a blue-to-warm afternoon gradient, soft sun and halo, and slowly drifting wisps using three noise octaves. Dark mode paints a dusk/night sky with a moon, halo, twinkling stars and softly lit clouds. Three closed, low-poly hill rings surround the tabletop; a merged tree line includes an original four-sailed lookout mill. The distant landscape sits below the tabletop and outside the camera's orbit range, with aerial fog matching the sky's horizon. CSS supplies only a solid fallback before the first frame.

Twelve merged puff clouds of varied sizes and heights drift through the distant landscape during both selection and play. Their projected bounding rectangles must clear the full board/character envelope, with extra padding, before they can appear; clouds also fade before touching screen edges. An instanced five-bird V passes occasionally. `prefers-reduced-motion` stops sky/puff drift and star twinkle and hides the passing flock. The existing FPS fallback also reduces sky noise from three octaves to two and disables star twinkle, alongside its shadow and pixel-ratio reductions. The share snapshot hides the entire atmosphere and retains the card's readable painted gradient.
