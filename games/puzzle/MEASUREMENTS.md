# Prototype verification — 2026-11-08

Environment: Node v24.22.2, Three.js 0.187.0, Vite 8.3.6. All work stayed in `games/puzzle/`; no deployment or commit was performed.

## Build and solver

`npm run build` passes strict TypeScript checking and production bundling. `npm test` passes all 15 tests, including full optimal solutions replayed through the public toggle/cross functions.

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
| CSS | 7,281 B | 2,335 B |
| JavaScript | 589,765 B | 149,089 B |
| Total | 598,161 B | 152,069 B |

Vite also reports its compressed JS estimate as 150.06 kB, below the 160 KB limit. It emits an advisory about the JavaScript chunk exceeding 500 kB raw. No runtime dependencies were added.


## Presentation choices

Soft shadows use cheap instanced blobs on every device. Victory uses jumping characters. Both are options permitted by the brief. Undo reverses one successful toggle or departure, so failure undo restores the loaded boat before its last crossing. No gameplay-rule deviations were needed.

## Runtime measurements (final build, 2026-11-08)

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
