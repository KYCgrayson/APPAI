# PRD — Video Subtitle Service (`my-tools` repo)

**Audience:** the agent or developer building the backend service in the
private `my-tools` repository.
**Status:** Draft v1 — not started
**Deploy target:** the author's always-on **iMac (Apple Silicon)**, exposed
via Cloudflare Tunnel at `subtitle.myaiapp.uk`.
**Companion docs:** `./api-spec.yaml` (canonical contract), `./appai-prd.md` (frontend consumer)

> **Read first:** `./api-spec.yaml`. It is the single source of truth for
> URLs, request bodies, response shapes, status codes, and error formats.
> This PRD is the implementation guide — it tells you *how* to build
> something that conforms to the spec.

---

## 1. Service overview

A self-hosted HTTP service that:

1. Accepts a YouTube URL + trim range + (optional) translation request.
2. Downloads the requested clip via `yt-dlp`.
3. Transcribes audio via Whisper (Apple Silicon GPU-accelerated).
4. Translates segments via an LLM (Claude API).
5. On a separate request, burns the user-edited subtitles into the
   trimmed video using FFmpeg.
6. Returns the rendered mp4 via signed URL with a 1-hour TTL.

Frontend consumer: `appai.info`'s `video-subtitle` section.

**Why the iMac instead of a NAS:** Whisper transcription is the slowest
stage. An Apple Silicon iMac with the Metal/MLX backend transcribes a
5-minute clip in ~10–20s, versus 60–90s on a typical NAS CPU. The iMac
stays powered on 24/7, so it can host the service. Cloudflare Tunnel
gives a stable public hostname without opening ports on the home router.

## 2. Non-goals (v1)

- Multi-tenant authentication. Per-IP rate limiting only.
- File upload. Source is YouTube URL only.
- Persistent job history beyond the 1-hour TTL.
- A web UI. The frontend lives in `appai.info`.
- Real-time captions (WebSocket / streaming ASR).

## 3. Recommended tech stack (macOS / Apple Silicon)

Recommendations are mainstream and well-documented so any agent (Claude,
GPT, Cursor) can follow existing tutorials. Substitutions are fine as
long as the contract in `./api-spec.yaml` is preserved.

| Concern               | Choice                                        | Why                                                                                  |
|-----------------------|-----------------------------------------------|--------------------------------------------------------------------------------------|
| HTTP framework        | **FastAPI** (Python 3.12+)                    | Native OpenAPI generation, Pydantic validation, async-first.                         |
| Schema validation     | **Pydantic v2**                               | Validates against the OpenAPI spec.                                                  |
| Server                | **Uvicorn** behind **Gunicorn**               | Standard FastAPI deployment.                                                         |
| Job queue             | **RQ** (Redis Queue) backed by Redis          | Simplest queue with retry, TTL, cancellation.                                        |
| Process model         | **Native Python venv** (NOT Docker)           | Docker Desktop on macOS cannot pass through the Apple GPU — Whisper would fall back to CPU. Run native to use Metal/MLX. |
| Process supervision   | **launchd** plists (or `brew services`)       | macOS-native way to keep web + worker + redis + tunnel running across reboots.       |
| YouTube download      | **yt-dlp** (Python lib, not CLI)              | Programmatic, handles age-gate, fragment download for trim.                          |
| ASR                   | **mlx-whisper** (Apple MLX, Metal-accelerated) | Native Apple Silicon GPU. ~10–20s for a 5-min clip. See §3.1 for Intel fallback.    |
| Translation           | **Anthropic Claude (Haiku 4.5)**              | Author already uses the Anthropic SDK. Haiku is fast and cheap for translation.      |
| Subtitle burn-in      | **FFmpeg ≥ 6.0** with **libass** (`brew install ffmpeg`) | `subtitles=` filter + `.ass` for full styling control.                    |
| Subtitle file format  | `.ass` (Advanced SubStation Alpha)            | Required for libass; richer than `.srt`/`.vtt` for styling.                          |
| Storage (artifacts)   | Local disk, e.g. `~/Library/Application Support/video-subtitle/` | Cleaned by a TTL job.                                            |
| Storage (job state)   | Redis (`brew install redis`)                  | Job records, TTL, signed-URL salt.                                                   |
| Reverse proxy / expose| **cloudflared** (`brew install cloudflared`)  | Named tunnel → `subtitle.myaiapp.uk`. TLS terminated by Cloudflare.                  |
| Keep-awake            | `caffeinate -s` (or `pmset` settings)         | Prevents the iMac sleeping and dropping the service.                                 |
| Observability         | **structlog** → JSON logs, `/healthz` endpoint | Standard.                                                                          |

### 3.1 ASR backend selection

- **Apple Silicon (M1/M2/M3/M4)** → `mlx-whisper`, model `medium` or
  `large-v3-turbo`. Metal-accelerated, fastest option.
- **Intel iMac (no Apple GPU)** → fall back to **`whisper.cpp`** (CoreML
  or CPU) or **`faster-whisper`** (CTranslate2, int8 CPU). Slower but
  works.
- Make the backend pluggable behind a single `transcribe(audio_path,
  language) -> segments` interface so the engine can be swapped via env
  (`ASR_ENGINE=mlx|whispercpp|faster`).

> **Confirm the iMac's chip** (Apple Silicon vs Intel) before picking the
> default — it decides whether `mlx-whisper` is even installable.

## 4. Repository layout (suggested)

```
my-tools/
└── services/
    └── video-subtitle/
        ├── README.md
        ├── pyproject.toml
        ├── api-spec.yaml              ← copy of ./api-spec.yaml; keep in sync
        ├── app/
        │   ├── main.py                ← FastAPI app, routes
        │   ├── models.py              ← Pydantic models matching the spec
        │   ├── jobs/
        │   │   ├── transcribe.py
        │   │   └── render.py
        │   ├── pipeline/
        │   │   ├── ytdlp_source.py
        │   │   ├── asr.py             ← pluggable: mlx | whispercpp | faster
        │   │   ├── claude_translate.py
        │   │   └── ffmpeg_burn.py
        │   ├── storage.py             ← signed URL minting, TTL cleanup
        │   ├── ratelimit.py
        │   └── errors.py              ← RFC 7807 helpers
        ├── launchd/                   ← *.plist for web, worker, ttl-cleaner
        ├── Procfile                   ← optional: honcho/foreman for local dev
        ├── tests/
        │   ├── test_contract.py       ← schemathesis against api-spec.yaml
        │   ├── test_pipeline.py
        │   └── fixtures/              ← short test clip + expected output
        └── scripts/
            ├── setup.sh               ← brew installs + venv + model download
            └── start-tunnel.sh        ← cloudflared named tunnel
```

## 5. Pipeline contracts

### 5.1 yt-dlp source download

- Use the `yt-dlp` Python library, not the CLI. Pass `download_ranges`
  to fetch only `[start_sec, end_sec]` to save bandwidth.
- Force `bestvideo[height<=1080]+bestaudio` to cap quality.
- Re-encode to a deterministic `mp4` before handing to ASR
  (FFmpeg `-c:v libx264 -c:a aac`).
- Output: `~/Library/Application Support/video-subtitle/{job_id}/source.mp4`.
- Map yt-dlp errors → `Problem.code`:
  - "Private" / "Video unavailable" / region geo-block → `source_unavailable`
  - Network timeout → `upstream_timeout`
  - Other → `source_unavailable` with detail string.

### 5.2 Whisper ASR

- Default `mlx-whisper` on Apple Silicon (see §3.1 for fallback).
- Extract audio to 16kHz mono wav with FFmpeg before ASR.
- Convert engine output to the spec's `Subtitle` shape; drop
  probability / token-level data.
- Auto-detect language if `asr.language="auto"`; persist detected
  language as `result.language` (BCP-47).
- **Performance budget**: ≤ 20s for a 5-minute clip on Apple Silicon.
  Update `progress.percent` every 5–10s in Redis.

### 5.3 Claude translation

- Anthropic Python SDK with **prompt caching** (the author's CLAUDE.md
  mandates caching for any Claude integration).
- Model: `claude-haiku-4-5-20251001`.
- One request per target language; send all segments together to
  preserve cross-segment context. 5 min of speech is typically <1500
  tokens.
- Prompt sketch:

  ```
  Translate the following timestamped subtitles into <TARGET_LANG>.
  Preserve segment count and ordering. Do not merge or split segments.
  Return strict JSON: {"segments":[{"id":...,"text":"..."}]}
  ```

- Use structured-output / JSON mode; validate with Pydantic, retry once
  on parse failure. Map errors → `translation_failed`.

### 5.4 FFmpeg burn-in

- Convert `StyleSpec` + `Subtitle[]` → `.ass` file via **pysubs2** (do
  not concatenate strings).
- Style mapping:

  | Spec field         | ASS field          | Notes                                     |
  |--------------------|--------------------|-------------------------------------------|
  | `font_family`      | `Fontname`         | "Noto Sans" — resolved by fontconfig.     |
  | `font_size_px`     | `Fontsize`         | Pass through.                             |
  | `color`            | `PrimaryColour`    | Convert `#RRGGBB` → ASS `&HBBGGRR&`.      |
  | `outline_color`    | `OutlineColour`    | Same conversion.                          |
  | `background.shape` | `BorderStyle`      | `box` → `3`; `none`/`rounded` → `1`.      |
  | `background.color` | `BackColour`       | Apply `opacity` via alpha byte.           |
  | `position`         | `Alignment`        | `top`=8, `middle`=5, `bottom`=2.          |
  | `display=bilingual`| Two style entries  | Render primary + secondary stacked.       |
  | `animation=fade`   | `\fad(150,150)`    | Inline override.                          |
  | `animation=slide_up` | `\move(...)`     | Inline override.                          |

- Run FFmpeg with `-vf "subtitles=subs.ass"`. Fonts resolve through the
  macOS fontconfig cache (no `fontsdir` needed once Noto fonts are
  brew-installed).
- Output: H.264 + AAC mp4, `-movflags +faststart` for progressive
  playback.
- **Performance budget**: ≤ 60s for a 5-min 1080p clip.

## 6. Job lifecycle implementation

- Job records in Redis under `job:{uuid}`; schema mirrors `Job` in the
  spec (Pydantic `model_dump_json`).
- Workers update `progress.percent` / `progress.stage` periodically.
- TTL: 1 hour from `completed_at` / `failed_at`. After TTL:
  - Delete artifact files on disk.
  - Set a Redis tombstone with `status=failed`, `error.code=job_expired`,
    expiring 24h later so polls return `410 Gone`, not `404`.
- Cancellation: `DELETE /jobs/{id}` sets a cancel flag in Redis; workers
  check it at each stage boundary and exit cleanly.

## 7. Rate limiting

- Per source IP, sliding 1-hour window.
- Initial limits: 5 transcribe + 3 render per IP per hour (env-tunable).
- Implement via Redis with the `limits` library.
- Always emit `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
- On 429: `Retry-After` header (RFC 6585) + RFC 7807 body with
  `code=rate_limited`.

## 8. CORS

```
Access-Control-Allow-Origin: https://appai.info   (echo if matches allowlist incl. *.appai.info)
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

Echo the request's `Origin` if it matches the allowlist; do not hard-code
`*` once auth is added. Preflight (`OPTIONS`) returns 204.

## 9. Security & privacy

- **Keep this repo private.** yt-dlp + YouTube ToS is a grey area best
  kept off the public surface (the parent CLAUDE.md spells this out).
- **Footer disclaimer** ("user must own rights to the video") is the
  frontend's responsibility.
- **Do not log full URLs or raw transcripts** outside debug mode. Log
  `job_id`, `kind`, `status`, durations, error codes, and a hash of the
  source URL.
- **API tokens** (`ANTHROPIC_API_KEY`) live in a `.env` file outside the
  repo or in the macOS Keychain. Never commit them.
- **Font (MVP).** Install Noto via Homebrew:
  `brew install --cask font-noto-sans font-noto-sans-cjk`. The frontend
  sends "Noto Sans"; fontconfig substitutes Noto Sans CJK for Japanese /
  Chinese glyphs automatically. One font name covers Latin + CJK.
- **Storage cleanup.** A separate launchd-managed worker scans the
  artifact dir every 10 minutes and deletes directories whose Redis job
  key has expired — defence-in-depth against worker crashes.

## 10. Observability

- `GET /healthz` → `{ status: "ok", version, redis: "ok"|"degraded" }`.
- Optional `GET /metrics` (Prometheus): `jobs_total{kind,status}`,
  `job_duration_seconds{kind,stage}`, `rate_limited_total`.
- Structured JSON logs:
  `timestamp, level, event, job_id, kind, stage, ip_hash, duration_ms`.

## 11. Testing requirements

| Layer            | Tool                                      | Scope                                                                          |
|------------------|-------------------------------------------|--------------------------------------------------------------------------------|
| Contract         | **Schemathesis** (`schemathesis run api-spec.yaml`) | Property-based testing against the spec — every endpoint, every status code. |
| Pipeline (unit)  | pytest                                    | Mock yt-dlp / Whisper / Claude / FFmpeg with fixture clips.                    |
| Pipeline (e2e)   | pytest + a 30-second public-domain clip   | Real ASR + FFmpeg; assert mp4 exists and is playable via `ffprobe`.            |
| Frontend e2e     | Playwright (in appai repo)                | Hits a staging instance of this service.                                       |

## 12. Acceptance criteria

1. `schemathesis` passes 100% against `./api-spec.yaml` on the running service.
2. The author's 5-min YouTube test URL completes both jobs and the mp4
   plays in the browser with burned subtitles.
3. Bilingual mode (e.g. JA audio → JA + EN) produces stacked subtitles.
4. Per-IP rate limit triggers a 429 with `Retry-After` after the 6th
   transcribe in an hour.
5. After 1 hour, `GET /jobs/{id}/file` returns `410 Gone` with
   `error.code=job_expired`.
6. `/healthz` returns 200, and the service survives an iMac reboot
   (launchd brings it back automatically).

## 13. Deployment (macOS / launchd)

No Docker. Native processes supervised by launchd so they restart on
crash and after reboot.

```
# One-time setup (scripts/setup.sh)
brew install redis ffmpeg cloudflared
brew install --cask font-noto-sans font-noto-sans-cjk
python3 -m venv .venv && source .venv/bin/activate
pip install -e .            # FastAPI, rq, yt-dlp, mlx-whisper, anthropic, pysubs2, limits, structlog
brew services start redis
# download the Whisper model once so first request isn't slow
python -m app.pipeline.asr --warmup
```

launchd jobs (one plist each under `~/Library/LaunchAgents/`):

| Label                          | Command                                                            |
|--------------------------------|-------------------------------------------------------------------|
| `uk.myaiapp.subtitle.web`      | `gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 2 -b 127.0.0.1:8000` |
| `uk.myaiapp.subtitle.worker`   | `rq worker transcribe render`                                     |
| `uk.myaiapp.subtitle.ttl`      | `python -m app.storage cleanup-loop`                             |
| `uk.myaiapp.subtitle.tunnel`   | `cloudflared tunnel run subtitle`                                |

- Set `KeepAlive=true` and `RunAtLoad=true` in each plist.
- The web process binds to `127.0.0.1:8000`; only cloudflared exposes it
  publicly, so no router port-forwarding is needed.
- Keep the iMac awake: `sudo pmset -a sleep 0 disablesleep 1` (or run the
  web plist wrapped in `caffeinate -s`).

Cloudflare Tunnel: create a named tunnel `subtitle`, map hostname
`subtitle.myaiapp.uk` → `http://127.0.0.1:8000`, store credentials in
`~/.cloudflared/`.

## 14. Open questions for the my-tools owner

1. ~~Hostname.~~ **Resolved**: `subtitle.myaiapp.uk` (Cloudflare Tunnel → iMac).
2. **iMac chip** — Apple Silicon or Intel? Decides `mlx-whisper` vs
   `whisper.cpp`/`faster-whisper` (§3.1).
3. **Whisper model size** — `medium` (faster, good enough) or
   `large-v3-turbo` (best quality, still fast on Apple Silicon)?
4. **Concurrency cap** — how many simultaneous jobs should the worker
   run? Set RQ worker count to match the iMac's headroom (start with 1–2).
5. **Redis** — fresh `brew install redis`, or reuse an existing Redis if
   another my-tools service already runs one?

---

## Appendix — Why this stack vs alternatives

| Choice            | Considered alternative                  | Why we picked the recommended option                                                  |
|-------------------|-----------------------------------------|---------------------------------------------------------------------------------------|
| Native + launchd  | Docker Compose                          | Docker Desktop on macOS can't pass the Apple GPU to containers — Whisper would lose Metal acceleration, the whole reason for using the iMac. |
| mlx-whisper       | faster-whisper / OpenAI Whisper API     | MLX is Apple-native, Metal-accelerated, self-hosted, zero per-call cost. API rejected by author. |
| RQ                | Celery / Dramatiq                       | Simplest queue with retry + cancel. Celery's complexity unjustified at this scale.    |
| Claude Haiku      | GPT-4o-mini / DeepL                     | Author already uses Anthropic; Haiku 4.5 cost ~ DeepL at higher quality on long form. |
| `.ass` + libass   | `.srt` + drawtext                       | drawtext loses positioning, animation, and bilingual stacking. libass is the standard.|
| pysubs2           | Hand-writing `.ass`                     | Hand-written `.ass` is brittle. pysubs2 authors it correctly.                         |
| RFC 7807          | Custom `{error: ""}` envelope           | Universal; httpx, OpenAPI generators, and agents all understand it.                   |
| AIP-151 LRO       | Synchronous endpoint with long timeout  | ~20s ASR + ~60s render = >1 min pipeline. Sync would tie up workers and connections.  |
| cloudflared       | Port-forward + DDNS                     | No router config, no exposed home IP, free TLS, stable hostname.                      |
