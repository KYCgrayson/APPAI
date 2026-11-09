# Assets and licenses

**Everything procedural:** all game art and audio are generated in code; no downloaded models, textures, fonts or audio files.

| Asset / third-party piece | Origin | License / status |
| --- | --- | --- |
| Three.js 0.187.0, including OrbitControls | Installed npm package `three` | MIT; bundled runtime library |
| @types/three | Installed development package | MIT; build-only type declarations |
| Vite 8 | Installed development package | MIT; build-only |
| TypeScript 5 | Installed development package | Apache-2.0; build-only |
| Farmer, wolf, goat, cabbage, rabbit and fox models | Generated in code, original, no external file | Original prototype artwork |
| Planked boat, oars, flag, bevelled layered banks, sandy shores, docks, tabletop, trees, bushes, grass, flowers, reeds, pebbles, signs, lanterns, butterflies and fireflies | Generated in code, original, no external file | Original prototype artwork |
| Water vertex/fragment shader, foam, wake, materials, highlights, soft shadow maps and blob shadows | Generated in code, original, no external file | Original prototype artwork; no texture files |
| 16-bar background music, win flourish, board/leave, sailing, landing, failure and victory sounds | Generated in code, original, no external file | Web Audio oscillators, filtered seeded noise and gain envelopes |
| Full-screen sky gradient, sun/moon discs and halos, 2–3 octave wispy-cloud noise, hashed stars and twinkle | Original Three.js GLSL shader in `src/scene/atmosphere.ts`, generated in code | Original prototype artwork; no texture files |
| Three closed hill rings, merged distant conifer line and four-sailed lookout mill, twelve merged puff clouds, instanced five-bird flock | Original low-poly geometry and seeded/formula placement in `src/scene/atmosphere.ts` | Original prototype artwork; no models or textures downloaded |
| Fonts | System fonts, nothing shipped | Platform-provided fonts; no downloadable font assets |
| Interface icons and star indicators | Original inline SVG house icon, Unicode text and CSS; no external file | Platform glyphs; original layout |
| Puzzle rules | Traditional folk logic puzzles | Public-domain concepts; original presentation and names |

Gameplay makes no network or AI calls. No CDN, external model, texture, audio, analytics, web font, or API is used. Vite's local development client connects to its local server for hot reload only; the production build has no such client. Dependency license notices are provided by the installed packages; Three.js retains its MIT header in the production bundle.
