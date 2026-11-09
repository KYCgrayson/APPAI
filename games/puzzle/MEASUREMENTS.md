# Prototype verification — 2026-11-09

Environment: Node v24.22.2, Three.js 0.187.0, Vite 8.3.6. All work stayed in `games/puzzle/`; no deployment or commit was performed.

## Build and solver

`npm run build` passes strict TypeScript checking and production bundling. `npm test` passes all 60 tests, including full optimal solutions replayed through the public toggle/cross functions.

| Level | BFS minimum | Includes boat restriction |
| --- | ---: | --- |
| Easy | 7 | Farmer required |
| Medium | 11 | 1–2 passengers |
| Hard | 13 | 1–3 passengers; rabbits never outnumbered aboard at departure; rabbit1 or fox1 must row |

BFS reduces states by counts of interchangeable animal kinds while preserving each captain’s location, retaining concrete passenger IDs for each solution. Every landed state, including boat passengers, is checked on both banks. Tests also cover empty departures, missing farmer, capacity, remote/unknown selections, frozen failures, immutable loading, and unsafe banks/boat loads.

Production file sizes measured with Node `fs.readFileSync` and `zlib.gzipSync` (bytes; gzip defaults):

| Output | Raw | Gzip |
| --- | ---: | ---: |
| HTML | 1,115 B | 645 B |
| CSS | 9,243 B | 2,774 B |
| JavaScript | 617,219 B | 158,819 B |
| Total | 627,577 B | 162,238 B |

Round 8 Vite reports its compressed JS estimate as 159.90 kB, below the requested 200 KB JavaScript gzip limit. It emits an advisory about the JavaScript chunk exceeding 500 kB raw. No runtime dependencies were added.


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
