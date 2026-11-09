# Tabletop Puzzle Collection

Three original, procedural 3D logic puzzles, each with three levels: River Crossing, Night Bridge and Water Pouring. Traditional Chinese and English, synthesized music/SFX, undo, local stars, personal leaderboards, share cards and challenge links. No downloaded art, new dependencies, runtime network or AI calls.

```sh
npm run dev
npm test
npm run build
```

Vite normally serves `http://localhost:5173`. `dist/` is a self-contained static build with relative assets; no parent Next.js changes are required. WebGL and a modern browser are required.

## Screens and controls

The collection home opens a puzzle's level menu; the house button during play returns to that menu. **← All puzzles / ← 所有謎題** or Escape on a level menu returns to the collection. The home keeps the last-played diorama rotating behind the cards (river by default). The About link appears only on collection home, outside iframes, and keeps the existing plain URL and `target="_top"`.

- **River:** tap a toy or chip to board/leave; tap the boat or Set sail. Space sails, Z undoes and R restarts. Passengers remain aboard on landing. All previous farmer, predator, captain, capacity and boat-balance rules are unchanged. Undo includes successful toggles and crossings and restores the loaded boat after failure.
- **Bridge:** select one or two friends on the lantern's side, then Walk, or tap the lantern/bridge. Space walks; 1–6 toggle friends; Z/R undo/restart. Travel takes the slower person's minutes. A timeout permits undo. The scene is always night, independently of the DOM theme.
- **Water:** tap one jug, then another to pour; tap the selected jug again to deselect. Easy includes a pump to fill and a flower bed to empty into, plus buttons. 1–3 select, F fills, E empties, Z/R undo/restart. Selecting never adds a step or history entry. Medium/Hard conserve the starting water and have no fill/empty controls.

Every game keeps the free horizontal orbit, polar range 0.15–1.30 radians, pinch/wheel zoom, reset view and empty-space double-tap reset. Music and SFX remain independent, remembered controls. Undo does not rewind the elapsed timer and is disabled after victory; restart begins a fresh timer. Inputs are locked during scene moves.

## Levels and stars

| Puzzle | Optimum, easy / medium / hard | Two-star ceiling | Failure limit |
| --- | --- | --- | --- |
| River | 7 / 11 / 13 crossings | 10 / 15 / 17 | Existing bank/boat rules |
| Bridge | 17 / 29 / 28 minutes | 18 / 31 / 30 | Lantern: 22 / 38 / 36 minutes |
| Water | 6 / 7 / 11 steps | 8 / 10 / 15 | None |

Three stars at or below optimum; two at or below the two-star ceiling; otherwise one on completion. The lantern lasts `ceil(optimal * 1.3)` so a child can win without finding the perfect answer. Its two-star threshold is `floor(optimal * 1.1)`; the fastest-escort plans (19 / 32 / 34 minutes) earn one star but still win. Exceeding the limit, rather than reaching it, extinguishes the lantern. Water gives a one-time undo/restart suggestion at twice optimum.

Each puzzle card shows stars out of 9. The collection total counts all nine levels, out of 27. Reference solvers are in `../../docs/games/solvers.py`; the local test suite independently solves/replays all nine levels through public actions.

## Architecture and bundles

- `src/main.ts`: routing, screens, HUD, history, storage and share flow.
- `src/routing.ts`: pure `resolveRoute(params, registry)`.
- `src/puzzles/types.ts`: common logic, scene, registry, action and scoring contracts.
- `src/puzzles/registry.ts`: all logic and localized strings; scene modules load through dynamic imports and preload on card hover/focus.
- `src/puzzles/{river,bridge,water}/`: pure logic, localized strings and separate scene chunks; river also owns its original layout.
- `src/scene/stage.ts`: renderer, lights/atmosphere presets, fitting to scene bounds, camera/controls, preferred picking, quality fallback, metrics and snapshots.
- `src/scene/models.ts`: original toy builders, shared palette/primitives, baking and resource disposal.
- `src/ui/home.ts`: collection HTML and original inline SVG icons.

Old `src/logic/index.ts` and `src/scene/layout.ts` paths re-export the moved river modules. `src/scene/index.ts` provides the legacy river-only `Diorama` facade. The original river solver still returns passenger lists; registry logic returns replayable actions for every puzzle.

Vite 8's function-form `manualChunks` groups `three` (including its installed addons) into a shared chunk, equivalent to the requested `three: ['three']` grouping; its typings reject the older object form. Each puzzle scene is a named lazy chunk. See `MEASUREMENTS.md` for every chunk's gzip size and validation limits.

The scenery uses three low, irregular, bluish-faded bands painted into the sky shader, above a calm ground fade. There are no hill walls, mound or windmill. The sun/moon sits away from the header; cloud clearance, reduced motion and the quality fallback remain. Scene switches dispose owned geometry/materials, badge textures and instance buffers while retaining shared primitive/palette resources.

## URL scheme

| URL query | Screen |
| --- | --- |
| No `game` | Collection home |
| `game=bridge` | Bridge levels |
| `game=water&level=medium` | Starts medium Water |
| `challenge=easy&c=7&t=42` | Legacy river levels + challenge |
| `game=bridge&challenge=medium&c=29&t=90&n=Amy` | Bridge levels + challenge |
| Unknown `game` | Collection home |

Navigation uses `history.replaceState`, preserving locale/theme/color/debug and other unrelated parameters. `locale=zh-TW` (any `zh*`) selects Traditional Chinese, otherwise English; the fallback is `navigator.language`. `theme=dark` styles the DOM and river; Bridge remains night and Water remains day. `color=426b58` accepts six hex digits with an optional URL-encoded `#`. `debug=1` shows metrics.

Challenge links always include `game`, `challenge`, `c` (score from that puzzle/level's optimum through 999), `t` (whole seconds 1–86399), and optional `n` (up to 12 sanitized Unicode characters). Duplicate/malformed fields invalidate the challenge. These are user-supplied challenges, not verified records. Lower score wins, then whole seconds.

## Storage and sharing

Runs use `{game, level, score, ms, at}` and retain the best five **per game and level**, ordered by score, milliseconds, then date. Storage keys are `river-runs/-stars/-hints`, `bridge-runs/-stars/-hints`, and `water-runs/-stars/-hints`. Old river `{crossings}` runs migrate to `score`. Nicknames read `puzzle-name`, fall back to `river-name`, and write `puzzle-name`. `river-music` and `river-sfx` remain shared and unchanged. `puzzle-last` remembers the last started puzzle. Unavailable storage is tolerated. Leaderboards are personal and per-device.

Victory sharing preserves the 1080×1350 Canvas card, native file sharing, silent cancellation and preview/download/copy fallback. Titles, units, optimum, rankings, CTA and filenames match the puzzle: `river-crossing.png`, `night-bridge.png`, `water-pouring.png`. Snapshots hide the atmosphere and river's decorative flyers. The nickname appears only in the card/challenge. Preview object URLs are revoked on close.

## Automation hooks

`window.__puzzleTest.state()` returns a clone of puzzle state plus `{game, level, screen, animating, elapsedMs, challenge}`. Screens are `home | levels | game`. Wait for `animating === false` after starts and moves, including lazy loading.

```js
__puzzleTest.act({type:'home'});
__puzzleTest.act({type:'open',game:'bridge'});
__puzzleTest.act({type:'start',game:'bridge',level:'easy'}); // game optional
__puzzleTest.act({type:'toggle',id:'1'}); // bridge IDs are minute strings
__puzzleTest.act({type:'walk'}); // go also works
__puzzleTest.act({type:'start',game:'water',level:'easy'});
__puzzleTest.act({type:'select',jug:1}); // zero-based
__puzzleTest.act({type:'fill',jug:1});
__puzzleTest.act({type:'pour',from:1,to:0});
__puzzleTest.act({type:'empty',jug:0});
```

`menu | undo | restart | share` remain available. River `toggle{id}` and `cross` remain identical, with `go` as a crossing alias. River IDs remain `farmer/wolf/goat/cabbage`, `rabbit1…5`, `fox1…5`.

`window.__puzzleMetrics` retains `{firstFrameMs, fps, drawCalls, triangles}`; firstFrameMs is the `performance.now()` timestamp of the first rendered puzzle frame. `window.__puzzleShare.lastUrl` holds the generated challenge URL and `lastCardDataUrl` exposes its PNG when `debug=1`.

See `ASSETS.md` for origins/licenses and `MEASUREMENTS.md` for what was and was not verified this round.
