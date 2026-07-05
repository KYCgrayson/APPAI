# PRD — `video-subtitle` section type (appai.info)

**Owner:** appai.info platform
**Status:** v1 — frontend implemented (Layers 1–3), pending backend integration
**Branch:** `claude/youtube-subtitle-tool-W1wnP`
**Companion docs:** `./api-spec.yaml`, `./my-tools-prd.md`

---

## 0. Status snapshot (read this first)

| Piece | State |
|-------|-------|
| Layer 1 — generic job primitives | ✅ implemented, committed (`012e26e`) |
| Layer 2 — video primitives | ✅ implemented, committed (`c93d3ab`) |
| Layer 3 — `VideoSubtitleSection` + wiring | ✅ implemented, committed (`217548d`) |
| Font set to "Noto Sans" | ✅ committed (`d529a90`) |
| Backend service (`my-tools`) | ⏳ not started — see `./my-tools-prd.md` |
| End-to-end author validation | ❌ blocked on backend |

The frontend is done. Nothing on the appai side blocks launch except the
backend being live at `subtitle.myaiapp.uk`.

## 1. Goal

A section type, `video-subtitle`, that lets a visitor paste a YouTube
URL, trim ≤ 5 minutes, auto-generate subtitles, translate into one or
more languages, customise the on-screen style, and download a new mp4
with the subtitles burned in.

The section is **anonymous** (no login), **stateless** (no DB writes),
and consumes a backend service implementing `./api-spec.yaml`. The
backend runs on the author's always-on **iMac** (Apple Silicon),
exposed via a Cloudflare Tunnel at `subtitle.myaiapp.uk`.

## 2. Non-goals (v1)

- File upload as a source. **YouTube URL only**. Upload is v2.
- Persistent storage of jobs / history per visitor.
- Auth / paid tiers. Abuse controlled by per-IP rate limits on the backend.
- Server-side editing of subtitles. Edits stay client-side, passed back on render.
- Word document tools (explicitly cut from scope).

## 3. Naming decision

The section type is **`video-subtitle`** (kebab-case, matches existing
`media-downloader` / `iframe-tool` / `pdf-viewer`). YouTube is an
implementation detail of the source-picker; naming the section after it
would force a rename when uploads / TikTok arrive. **Locked** — agents
write pages against this type.

## 4. User flow (state machine)

```
  ┌─ idle
  │   └── user pastes YouTube URL (oEmbed preview card appears)
  ↓
  idle (cont.)                         pick trim + target languages
  │   └── click "Start"
  ↓
  transcribing  ─── progress polling ──→  error
  │   └── result.segments arrives
  ↓
  editing
  │   ├── edit subtitle text (optional)
  │   ├── adjust style (size, position, bg, animation, single/bilingual)
  │   └── click "Render"
  ↓
  rendering  ───── progress polling ──→  error
  │   └── result.file_url arrives
  ↓
  done  (mp4 plays w/ live SubtitleOverlay + Save File button)
```

Two backend round-trips = **two independent jobs** (`kind=transcribe`
then `kind=render`) per `./api-spec.yaml`. Resume-on-reload is a v2
stretch goal; v1 resets on reload.

## 5. Section data shape (page JSON)

```json
{
  "type": "video-subtitle",
  "data": {
    "heading": "YouTube Subtitle Studio",
    "description": "Paste a YouTube link and get a translated, subtitled video.",
    "apiBase": "https://subtitle.myaiapp.uk/v1",
    "maxDurationSec": 300,
    "supportedLanguages": ["en", "ja", "ko", "zh-Hans", "zh-Hant", "es", "fr", "de", "hi"],
    "strings": { "...": "i18n overrides" }
  }
}
```

| Field                 | Type     | Required | Notes                                                         |
|-----------------------|----------|----------|---------------------------------------------------------------|
| `heading`             | string   | no       | Section heading.                                              |
| `description`         | string   | no       | Subtitle below heading.                                       |
| `apiBase`             | url      | yes      | Backend base URL, incl. `/v1` (e.g. `https://subtitle.myaiapp.uk/v1`). |
| `maxDurationSec`      | number   | no       | Default 300. Cap on `end - start` of trim.                   |
| `supportedLanguages`  | string[] | no       | BCP-47 codes in the language picker. Default: 9 langs.        |
| `strings`             | object   | no       | Same `data.strings` pattern as `MediaDownloaderSection`.      |

**Font.** MVP ships one embedded font: **`Noto Sans`** (covers Latin;
fontconfig auto-substitutes Noto Sans CJK for CJK glyphs). Frontend
does not expose a font picker; `MVP_FONT_FAMILY` is hard-coded in
`src/templates/shared/video/types.ts`. v2 may introduce a picker.

Validation: matches the `SectionFieldDef` pattern in
`src/lib/template-registry.ts`. No new Zod schema; section content is
generic JSON, sanitised by `sanitizeContent()` like every section.

## 6. Component architecture (as built)

### Layer 1 — generic async-job primitives (`src/templates/shared/jobs/`)

| File                  | Responsibility                                                |
|-----------------------|---------------------------------------------------------------|
| `types.ts`            | TS mirror of `Job`, `Progress`, `Subtitle`, `StyleSpec`, `Problem` from the spec. |
| `use-async-job.ts`    | 2s polling hook, exp back-off, cancel, abort-on-unmount.      |
| `JobProgress.tsx`     | Progress bar + stage label + cancel button.                  |
| `DownloadResult.tsx`  | Signed-URL download via `<a download>`.                       |

No video knowledge — reusable by future PDF / audio tools.

### Layer 2 — video primitives (`src/templates/shared/video/`)

| File                        | Responsibility                                                |
|-----------------------------|---------------------------------------------------------------|
| `types.ts`                  | `SourceValue`, `TrimValue`, `MVP_FONT_FAMILY`, `DEFAULT_STYLE`. |
| `MediaSourcePicker.tsx`     | YouTube URL input + paste/clear + oEmbed preview card.       |
| `TimelineTrimmer.tsx`       | M:SS numeric inputs with constraint validation.              |
| `SubtitleEditor.tsx`        | Editable segment list, click timestamp to seek.             |
| `SubtitleOverlay.tsx`       | Live overlay over `<video>` via rAF-driven currentTime.     |
| `SubtitleStyleControls.tsx` | Size, position, background, animation, single/bilingual.    |

### Layer 3 — orchestrator (`src/templates/sections/`)

| File                        | Responsibility                                                |
|-----------------------------|---------------------------------------------------------------|
| `VideoSubtitleSection.tsx`  | `"use client"`. Owns the §4 state machine. Composes Layers 1+2. |

### Wiring

| File                                   | Change                                       |
|----------------------------------------|----------------------------------------------|
| `src/templates/shared/PageRenderer.tsx`| `case "video-subtitle"` → renders the section. |
| `src/lib/template-registry.ts`         | `SECTION_DEFS` entry mirroring §5.            |
| `AGENT_INSTRUCTIONS.md`                | Section-types table row + example payload.    |

## 7. i18n

English + Traditional Chinese for section UI strings via the
`data.strings` merge pattern (see `MediaDownloaderSection.tsx`). The
hosted page can still be created in any platform locale.

## 8. CSP / build constraints

- `connect-src 'self' https:` already permits `subtitle.myaiapp.uk`
  (`next.config.ts`). No CSP edit required.
- Inline styles permitted — `SubtitleOverlay` uses inline styles for
  live updates.
- The section is `"use client"`; PageRenderer stays RSC.

## 9. Acceptance criteria

1. Author pastes a 5-min YouTube URL on a page with a `video-subtitle`
   section, runs transcribe → edit → render, downloads a playable mp4
   with burned subtitles.
2. Same flow works with `display=bilingual` (e.g. JA audio → JA + EN).
3. Polling stops on `completed | failed | cancelled`. No fetch loops.
4. Backend errors surface keyed off `Problem.code`
   (e.g. `source_unavailable` → "This video is unavailable or region-locked.").
5. `npm run build` succeeds (no new TS / ESLint errors).
6. Trim inputs enforce `≤ maxDurationSec`; Start disabled when out of range.

## 10. Known v1 gaps (documented in code)

- **No live overlay during the editing phase** — needs a preview URL in
  `TranscribeResult` or a YouTube IFrame Player integration. Editing
  shows a static style preview pane; the final mp4 plays with a live
  overlay in the done phase.
- **No visual dual-handle scrubber** — needs source duration from a
  metadata endpoint. M:SS numeric inputs cover MVP.
- **SubtitleEditor click-to-seek is a no-op** until live preview lands.

## 11. Out-of-scope but planned (v2+)

File upload; resume-on-reload via URL hash; auto-translate-as-you-type;
font picker; captions-only `.vtt` export; multi-clip stitching.

## 12. Open questions

1. ~~Production hostname.~~ **Resolved**: `subtitle.myaiapp.uk` (Cloudflare
   Tunnel → iMac).
2. ~~Section name.~~ **Resolved**: `video-subtitle`.
3. ~~Font.~~ **Resolved**: single embedded "Noto Sans" (+ Noto Sans CJK
   substitution). No picker in v1.

---

## Appendix — Why two jobs, not one stateful job

Industry convention (AssemblyAI, Deepgram, AWS Transcribe, OpenAI): an
async job is linear (`queued → processing → terminal`). A job that
pauses mid-flight for human input is a non-standard state machine and
hard for any future agent to follow.

Splitting means `transcribe` is reusable for "subtitles only" and
`render` for "I already have subtitles, just burn them". Each job's
lifecycle matches AIP-151 verbatim, so SDK generators and agent tooling
work without bespoke logic.
