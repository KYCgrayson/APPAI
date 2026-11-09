# Round 12 verification — 2026-11-09

All changes remain in `games/puzzle/`. No dependencies, downloaded assets, network access, commits or hook changes were introduced. Existing test, metrics and sharing globals remain intact.

## Automated checks

- `npm test`: **120 passed, 0 failed**.
- `npm run build`: **passed**, strict TypeScript and Vite production bundling.
- `git diff --check`: **passed**.

The suite includes pure arithmetic camera-fit tests at **375×812, 390×844, 768×1024, 800×600 and 1440×900**, plus independent projection of actual visible scene boxes for all nine puzzle/level combinations. A real Stage test replaces only WebGL/controls with stubs, queues rAF without executing it, and verifies that the constructor renders nothing and mount/resize synchronously render the mounted board with the correct night preset. Other regressions cover camera preservation on HUD reflow/reset, quality persistence, default-camera snapshots, separate share-sky/card palettes, loading races, keyboard pouring, Rules guards, scene reuse, deferred popstate, timeout/undo timing, challenge reloads/limits, reachable bridge scoring, vertex-colour preservation/disposal and one-action BFS hints from every reachable easy-water state.

These checks exercise real logic/controller/scene code but **do not render browser pixels or use a GPU**. The controller tests use minimal DOM and scene stubs; Stage tests use renderer/controls stubs. The pure fit test uses no DOM or Three.js camera.

## First-frame root cause and framing

The constructor previously called `loop()` synchronously before any lazy puzzle scene was mounted. This painted an empty day atmosphere; mount changed the scene and camera but did not render. If rAF was throttled by an offscreen iframe, background tab or WebView, that empty day frame remained visible. The constructor now only schedules rAF, and the loop skips rendering until a scene exists. Mount and resize synchronously update controls, atmosphere and the renderer, even if rAF never fires. The body `night` class follows `stage.night`, including Bridge under a light DOM theme.

The pure fit measures camera-up min/max relative to the initial `(0,.4,0)` target, translates the target along camera-up to their midpoint, then fits all corners with perspective depth. Width/height allowances are **.90 / .94 in both orientations**, replacing the landscape .70 height allowance. Scene bounds include character/badge height and the bridge water floor. Water's table is now **8.4×5.9** (previously 10×6.9), with wider jugs, closer badges and a 2.4 top bound (2.5 for Hard). Layout changes update the saved default fit while preserving player-chosen position, target and zoom. Mount/reset explicitly restore the default.

## Review corrections

- Bridge Easy's two-star ceiling is **19**, with reachable winning scores 17/19/20/21/22; the fastest-escort plan now earns two stars. Medium/Hard remain 31/30, and limits remain 22/38/36.
- Water digits use the same select/pour path as chips and picks. Easy hints select one BFS action from current contents, independent of step count.
- Home navigation remains available during chunk loading; versioned loads reject stale completions. Back/forward waits for a busy scene's callback. Rules blocks undo/restart. Same-game/level restart re-syncs the existing scene. Failure stops elapsed time; undo resumes it.
- Challenge decoding and stored-run migration enforce level limits inclusively. Challenge fields stay in the active game URL and reload into that game.
- Share snapshots use a cloned default camera fitted to the card's 936×590 image region, preserving the player's view and restoring renderer dimensions/visibility. The card's sky uses scene night separately from the DOM palette.
- Bridge HUD text uses registry strings; exposure belongs to Stage. A fixed pair of Stage-owned point lights avoids changing light counts across scene/theme switches. Low quality persists when atmosphere objects are replaced.
- About keeps its existing URL and uses “← About” / “← 關於這個遊戲”. The unused `back` string is removed.

## Sky and draw submissions

The Round 11 checkout already removed the windmill/treeline, so there was no nested `bake(mill)` to remove. The baking helper now preserves existing vertex colours when rebaking and releases owned intermediate geometry/materials, with a regression test. No windmill or extra scenery draws were introduced.

Gradient, sun/moon, cloud noise and painted horizon now use world view rays reconstructed from inverse projection and camera world matrices, including view offsets and pitch. A top-down camera samples ground rather than a horizon fixed to screen bottom. Stars use a sin-free Hoskins hash12 with bounded cell coordinates. Birds use `DoubleSide` and `toneMapped:false`. Existing 5,760-configuration cloud-clearance tests and reduced-motion checks still pass.

The conservative material/shadow submission census includes **all 14 possible atmosphere draws**, hidden-group children, one extra submission per shadow caster, and two passes for double-sided transparent materials; it applies no camera culling. River failure markers are merged and do not cast shadows.

| Puzzle | Maximum initial census | Maximum sampled gameplay census |
| --- | ---: | ---: |
| River (day and night) | 138 | **158** |
| Bridge | 53 | **59** |
| Water | 46 | **53** |

Gameplay samples cover all levels' optimal actions, intermediate animations, selection/hover and victory; River also includes the nine-traveler Hard failure in night mode. Tests enforce ≤160 submissions through optimal replays and night failure states. This is **a conservative geometry census, not a measurement of GPU draw calls for every possible state**. The real-phone 60 FPS target remains unmeasured.

## Production bundles

Measured from the final `dist/assets/*.js` using Node `zlib.gzipSync` defaults, summing **all** JS chunks (decimal bytes):

| Chunk | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| bridge-scene-Cn6D-Dcq.js | 5,965 | 2,537 |
| helpers-DCDs6RHe.js | 784 | 527 |
| index-Bb034Mrb.js | 74,978 | 28,997 |
| river-scene-IILKuYne.js | 11,326 | 4,668 |
| three-L7Zacm_L.js | 576,451 | 141,016 |
| water-scene-Bn1xkll5.js | 7,102 | 2,865 |
| **All JavaScript** | **676,606** | **180,610** |

Budget: **220,000 B** gzip; remaining: **39,390 B**. HTML: 1,198 B raw / 672 B gzip. CSS: 12,514 B raw / 3,458 B gzip. Vite's gzip estimate differs slightly from Node defaults; both stay under budget. Its existing raw Three.js chunk warning remains.

## Browser verification limits

`npm run preview -- --host 127.0.0.1` failed with **listen EPERM at 127.0.0.1:4173** under the process sandbox. No permissions, alternate server, network or browser-policy workaround was requested or attempted. Therefore current browser pixels/GLSL appearance, share/native-share flow, actual GPU draw calls and real-phone FPS are **not verified** in this round. Prior runtime tables below are historical evidence only.

<details>
<summary>Historical Round 11 and earlier measurements (not current runtime evidence)</summary>

# Round 11 verification — 2026-11-09

The collection, shared Stage, two new puzzles, generalized sharing/storage and low horizon scenery are implemented in games/puzzle/. No dependencies, external assets, deployment or commits were added.

## Automated checks

- npm test: **97 passed, 0 failed**, including all original 65 tests.
- npm run build: **passed**, strict TypeScript and Vite production bundling.
- git diff --check: **passed**.
- The prepared parent-plan patch passes git apply --check. The parent document itself is outside the writable workspace and was not modified; apply puzzle-plan-round11.patch from the repository root when permitted.

| Puzzle | Easy optimum | Medium optimum | Hard optimum | Two-star ceilings | Lantern limits |
| --- | ---: | ---: | ---: | --- | --- |
| River | 7 crossings | 11 crossings | 13 crossings | 10 / 15 / 17 | — |
| Bridge | 17 min | 29 min | 28 min | 18 / 31 / 30 | 22 / 38 / 36 min |
| Water | 6 steps | 7 steps | 11 steps | 8 / 10 / 15 | — |

Bridge Dijkstra and Water BFS solutions replay through public actions at every optimum. Tests cover immutable inputs, bridge selection/capacity/remote/frozen/timeout boundaries, naive fastest escort (19/32/34), water conservation/rejections/goals, registry stars, URL routing and per-puzzle challenge validation, Run.score migration and per-game ranking.

Headless geometry checks instantiate and dispose every puzzle/level, replay each optimal scene animation, and verify each callback fires once with busy cleared. They exercise actual Stage camera fitting at 375×812, 390×844, 768×1024, 800×600 and 1440×900 using representative reserved HUD/control regions. These are numerical projection checks, **not CSS/pixel verification**. Existing atmosphere tests still exercise cloud clearance over 5,760 orbit/zoom/theme configurations. All text badges use a stub canvas in Node scene tests; no browser or GPU rendering is implied.

## Production bundles

Measured from the final dist/assets/*.js with Node zlib.gzipSync defaults, summing **all** JS chunks (decimal bytes):

| Chunk | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| bridge-scene-B27mpCPz.js | 6,024 | 2,606 |
| helpers-dJEmR_zX.js | 784 | 527 |
| index-Bkt-gCRk.js | 72,195 | 28,120 |
| river-scene-lBCW4jXc.js | 11,192 | 4,622 |
| three-L7Zacm_L.js | 576,451 | 141,016 |
| water-scene-C62xRwrq.js | 7,059 | 2,840 |
| **All JavaScript** | **673,705** | **179,731** |

Budget: **220,000 B** gzip; remaining: **40,269 B**. Vite's compression estimate differs slightly from Node gzip defaults; both are under budget. The existing warning about a raw chunk over 500 kB refers to shared Three.js, not a gzip-budget failure. Three and its installed addons share one chunk, and each puzzle scene has a named dynamic chunk. Card hover/focus preloads that scene.

## Scenery and rendering

The tall circular hill walls and windmill were removed. Three low, irregular, blue-hazed bands are painted into the background shader, with calm flat ground fading below them. Their maximum top is below 28% of viewport height measured from the bottom, independent of orbit, so they cannot become a dome behind the board. The sun/moon uses an open left-side position on narrow layouts and the gap between the heading and toolbar on wide layouts. The sky, clouds, stars, reduced-motion behavior and atmosphere-free share snapshot remain.

A conservative initial-scene material/shadow submission census (maximum of three levels, plus all 14 possible atmosphere draws) gives **River 147 / Bridge 53 / Water 46**. It deliberately counts children inside hidden decoration groups and extra transparent passes, and does not apply camera culling. The automated scene check stays below 160 at each initial state. These are geometry counts, **not GPU-measured draw calls for every gameplay state**. Actual rendered draw calls and the 60 FPS phone target remain unmeasured this round. Scene disposal releases owned geometries, materials, badge textures and instance buffers; shared primitive/palette caches remain reusable.

## Browser verification limits

Starting Vite on 127.0.0.1:5173 failed with listen EPERM under the filesystem/process sandbox. The connected Chrome browser's automatic approval review also rejected opening http://localhost:5173 because access to that origin was not granted. No alternate browser surface, external server, local-file workaround or policy bypass was attempted.

Consequently the requested light/dark pixel checks at 375×812, 390×844, 768×1024 and 1440×900, the zh-TW 800×600 scenery inspection from default/low/top-down cameras for all three puzzles, actual chip wrapping/44 px hit targets/overlap, audio listening, share-card/native-share smoke checks and real-phone FPS are **not browser-verified**. CSS specifies minimum 44 px buttons, wrapping chips, scrolling menus and separate view-tool/header rows; these still need visual QA.

Collection total uses 27 stars (nine levels × three stars); each puzzle card uses the specified 9-star total. Optional Coming Soon card was omitted.

<details>
<summary>Historical Round 10 and earlier measurements (not current runtime evidence)</summary>

# Prototype verification — 2026-11-09

Environment: Node v24.22.2, Three.js 0.187.0, Vite 8.3.6. All work stayed in `games/puzzle/`; no deployment or commit was performed.

## Build and solver

`npm run build` passes strict TypeScript checking and production bundling. `npm test` passes all 65 tests, including full optimal solutions replayed through the public toggle/cross functions.

| Level | BFS minimum | Includes boat restriction |
| --- | ---: | --- |
| Easy | 7 | Farmer required |
| Medium | 11 | 1–2 passengers |
| Hard | 13 | 1–3 passengers; rabbits never outnumbered aboard at departure; rabbit1 or fox1 must row |

BFS reduces states by counts of interchangeable animal kinds while preserving each captain’s location, retaining concrete passenger IDs for each solution. Every landed state, including boat passengers, is checked on both banks. Tests also cover empty departures, missing farmer, capacity, remote/unknown selections, frozen failures, immutable loading, and unsafe banks/boat loads.

Production file sizes measured with Node `fs.readFileSync` and `zlib.gzipSync` (bytes; gzip defaults):

| Output | Raw | Gzip |
| --- | ---: | ---: |
| HTML | 1,115 B | 646 B |
| CSS | 10,396 B | 2,973 B |
| JavaScript | 625,346 B | 161,885 B |
| Total | 636,857 B | 165,504 B |

Round 10 Vite reports its compressed JS estimate as 162.91 kB, below the requested 200 KB JavaScript gzip limit. It emits an advisory about the JavaScript chunk exceeding 500 kB raw. No runtime dependencies were added.


## Presentation choices

Round 7 retains instanced contact blobs and adds one 512×512 PCF soft shadow map with a tight frustum. Shadows are disabled and pixel ratio reduced if average FPS over the initial two seconds is below 45. Victory uses jumping characters. Undo reverses one successful toggle or departure, so failure undo restores the loaded boat before its last crossing. No gameplay-rule deviations were needed.

## Historical runtime measurements (pre-Round 7 build, 2026-11-08)

Measured against `vite preview` of the production build (`http://localhost:4173`). Machine: Apple-silicon desktop (M5 Ultra). Browser: Google Chrome (headed, Playwright, cache disabled), WebGL renderer `ANGLE Metal Renderer: Apple M5 Ultra`. Network throttling via CDP `Network.emulateNetworkConditions`; the phone profile also uses CDP CPU throttling 4×. Load times are from navigation start.

| Profile | Network | Transferred | `load` event | First 3D frame |
|---|---|---:|---:|---:|
| Desktop 1440×900, DPR 2 | none (localhost) | 149.6 KB | 67 ms | 66 ms |
| Desktop 1440×900, DPR 2 | Fast 4G (9 Mbps, 60 ms RTT) | 149.6 KB | 299 ms | 297 ms |
| Desktop 1440×900, DPR 2 | Slow 4G (1.6 Mbps, 150 ms RTT) | 149.6 KB | 1,090 ms | 1,089 ms |
| Phone 390×844, DPR 3, CPU 4× slower | none | 149.6 KB | 204 ms | 133 ms |
| Phone 390×844, DPR 3, CPU 4× slower | Fast 4G | 149.6 KB | 442 ms | 376 ms |
| Phone 390×844, DPR 3, CPU 4× slower | Slow 4G | 149.6 KB | 1,231 ms | 1,158 ms |

FPS while playing the hard level (10 characters, 5 one-second samples):

| Profile | FPS samples | Draw calls | Triangles |
|---|---|---:|---:|
| Chrome desktop 1440×900 | 60, 60, 60, 60, 60 | 103 | 6,740 |
| Chrome phone 390×844, CPU 4× | 60, 60, 60, 60, 60 | 109 | 7,220 |
| iOS 27.2 Simulator Safari (iPhone 18 Pro Max), menu, `?theme=dark` | 60 (debug overlay) | 60 | 3,640 |

iOS Simulator first frame: 62 ms (warm Safari) on the final build; 1,731 ms on the first, cold visit of an earlier build.

**Limits of these numbers:** all GPU work ran on the Mac's GPU. Chrome's CPU throttling slows JavaScript, not the GPU, and the iOS Simulator renders with the Mac's GPU, so neither is a real phone. **No real phone has been measured yet**; that is required before release.

Checked by hand and by an independent reviewer (Chrome via Playwright): tapping 3D models picks the right piece; all three levels can be won at the optimum (the reviewer drove this in the browser before the captain rule was added; the new hard level is covered by a test that replays its 13-crossing solution through the same public functions); fail → undo/restart; input during the sailing animation is ignored; light and `?theme=dark` sky gradients render behind the scene; every button is at least 44×44 px at 375 px width; the page loads only same-origin files.

## Round 4 verification — 2026-11-09

Added a pure sharing module with 32 new tests (47 total), elapsed timer, per-device run storage, validated challenge receiving, synchronous WebGL snapshot, Canvas PNG card, native sharing and preview/download/clipboard fallback. The table above was remeasured from the final production build using Node gzip defaults. Total JavaScript is 153,261 bytes gzip, below even the decimal 160,000-byte cap. Vite uses a different compression estimate (154.30 kB); both are under the limit.

`npm test` and `npm run build` pass. No dependencies were added. Browser QA was attempted but could not run in this restricted session: binding Vite's local listening port returned EPERM, and launching Chrome through the existing external Playwright installation aborted with permission errors. Consequently the new card, native sharing, clipboard fallback, and 375×812 / 1440×900 layouts have not been visually verified in this round. Earlier runtime measurements above are historical and were not repeated for this build.


## Round 7 verification — 2026-11-09

`npm test`: **51 passed, 0 failed**. `npm run build`: **passed** (TypeScript and production bundle). The build-size table at the top is remeasured for this round using Node `gzipSync` defaults. JavaScript totals **157,696 B gzip**, leaving **42,304 B** under the decimal 200,000 B budget. No npm dependencies, external assets or runtime network calls were added. All existing test/metrics/share globals and share-card code remain in place.

Repeated props use instanced batches; toy decoration, trees, clouds, dock/sign details and boat planks are merged into vertex-colored meshes. Each non-cabbage traveler uses three visible meshes (body, blinking eyes, moving ears/tail). Props remain outside the picking list. Water animation runs in the material shader without per-frame geometry uploads.

**Current runtime numbers are left for the reviewer:** hard-level draw calls (target ≤160), actual-phone FPS (target 60), Slow 4G first frame (target well below 2 s), dark/day screenshots, audio listening, autoplay/visibility behavior and share-card browser smoke checks. Prior runtime tables above are historical, not evidence for this round. Vite could not bind `127.0.0.1:5173` (`EPERM`). A fallback Playwright attempt using local-file request fulfillment also failed to launch Chrome (SIGABRT / sandbox permission errors). No current runtime results are claimed.


## Round 8 verification — 2026-11-09

`npm test`: **60 passed, 0 failed**. `npm run build`: **passed**. `git diff --check`: passed. The size table at the top reflects this build, measured with Node `gzipSync` defaults. JavaScript is **158,819 B gzip**, leaving **41,181 B** under the decimal 200,000 B budget. Vite retains its advisory about raw chunks above 500 kB. No dependencies, external assets, network requests, commits or hook changes were introduced; existing test/metrics/share hooks remain intact.

Camera controls allow unlimited horizontal orbit, polar angles 0.15–1.30 radians, and pinch/wheel zoom at 0.6–1.6 times fitted distance. Reset view (localized, 44 px minimum) and double-tapping/clicking empty scene space smoothly return along a spherical orbit, preserving camera height and distance during the transition. Level starts/restarts and menu transitions reset framing explicitly. Multi-touch never selects a traveler; the 8 px drag threshold remains. UI copy uses bank-relative language without fixed left/right assumptions, and help now mentions zoom.

The canvas covers the full window, with a view offset fitting the board between the gameplay panels. Clouds are lower and closer to the board, and fade as complete objects before reaching window edges. Clouds and birds do not cast shadows. Eyes blink around their centres, ears sway around their roots, and tails have separate root pivots. Six new geometry tests verify blink height and pivots. Three new clearance tests check conservative scenery footprints against every slot on both banks of all three levels. Trees are narrower and moved to z=-3.75; bushes sit around x=±4.75, z=3.66; signs are narrowed between the traveler columns; rocks move to z=3.72. These positions leave clearance even around the hard level’s x=±4.1, z=±2.8 slots.

The shadow FPS window begins after the first completed render and restarts on returning to a visible tab; fallback also disables the directional light’s shadow casting. Firefly/blob matrices and scale vectors are reused, actor phases and victory status are cached during sync. Audio unlock retries on pointerdown/up, touchend and click while the context is not running; noise buffers are cached by duration. Music, SFX and reset share one top-right cluster; responsive rules reserve separate space above the phone/tablet topbar.

**Runtime verification limitation:** the existing local Playwright installation was used to attempt a Chrome launch; Chrome aborted with SIGABRT/EPERM under the sandbox. No dependencies were installed and no network was used. Consequently screenshots and overlap checks at 375×812, 390×844, 768×1024 and 1440×900, arbitrary-angle picking/zoom/reset gestures, iOS audio listening and current phone FPS are **not browser-verified** in this round. The CSS reserves space for the cluster at those breakpoints, but the 60 FPS phone target remains unmeasured. Earlier runtime figures above are historical.


## Round 10 verification — 2026-11-09

`npm test`: **65 passed, 0 failed**. `npm run build`: **passed**, including strict TypeScript. `git diff --check`: passed. The top build-size table now measures this final Round 10 build with Node `gzipSync` defaults. JavaScript is **161,885 B gzip**, leaving **38,115 B** under the decimal 200,000 B budget. Vite's independent estimate is 162.91 kB; its existing raw-chunk advisory remains. No npm dependencies or downloaded assets were added, no runtime network requests were introduced, and no commits were made.

Home is an inline SVG house plus **首頁 / Home**, 60 px wide on phones and 64 px on larger screens, with a minimum height of 44 px. It is the leading control in the level header, followed by the title. It uses the existing `menu` action and sailing lock. The toolbar's duplicate menu action is removed; result sheets use **回首頁 / Home**. The menu's localized About link has a plain URL and `target="_top"`, and is omitted when iframe detection reports framing or throws. Existing test/metrics/share hooks, camera controls, independent music/SFX toggles and the share-card flow are retained. Snapshots temporarily hide the atmosphere as one group and restore it in `finally`, keeping the card's existing gradient.

The full-screen Three.js sky is one draw, with `depthWrite:false`, a gradient, sun/moon and halo, three-octave drifting cloud noise, and night-only hashed stars. The FPS fallback drops to two octaves and skips star twinkle. Reduced motion freezes cloud time and twinkle and hides the passing flock, including preference changes while playing. Three continuous hill rings and the merged conifer line/lookout mill cost **four draws**. Twelve separately merged puffs and a five-instance bird flock bring the atmosphere to a conservative **18-draw maximum** if every mesh were visible. Atmospheric objects cast no shadows. This is a geometry/material census, **not a measured whole-game hard-level draw-call count**; screen/frustum culling usually hides most puffs.

Five new regression tests cover depth clipping, the screen clearance margin, actual puff vertices across **5,760 camera configurations** (four viewport sizes × 48 azimuths × five elevations × three zoom factors × two themes), reduced-motion/fallback behavior, and ray-tested celestial-disc clearance around the hill ring. Every visible puff clears the projected board/toy envelope, including during unrestricted orbit and zoom. Representative unobstructed gameplay regions at 375×812, 390×844, 768×1024 and 1440×900 are used for these projection tests. These tests do not render pixels or measure CSS layout. Default fitted views retain visible puffs at each size. Phone/tablet CSS places the level header below the view-tools cluster; desktop reserves its right-hand space. Safe-area offsets are included, and menu panels scroll above the bottom safe area.

**Browser QA remains unverified:** Vite could not bind a local port (`EPERM`); a local static-server attempt also returned `EPERM`. The connected browser's automatic approval review rejected opening the self-contained local-file preview because its URL policy allows only HTTP/HTTPS. No alternate browser surface or policy workaround was attempted. Consequently current pixel/layout checks at the four requested sizes, iframe navigation, rendered GLSL/day/night appearance, share-card smoke checks, hard-level draw calls (target ≤160), and actual-phone FPS (target 60) could not be measured. Earlier runtime tables remain historical and must not be treated as Round 10 results.

</details>

</details>
