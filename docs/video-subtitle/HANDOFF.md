# Handoff — Video Subtitle backend (for the `my-tools` agent)

This file tells the agent in the **`my-tools`** repo what to build and how
to stay in sync with the `appai.info` frontend, which is already done.

## Context in one paragraph

`appai.info` has a finished frontend section (`video-subtitle`) that lets a
visitor paste a YouTube URL, trim ≤ 5 min, transcribe, translate, style,
and download a burned-subtitle mp4. It talks to a backend over the HTTP
contract in `api-spec.yaml`. Your job is to build that backend. The two
sides never talk directly — the contract is the only interface. The human
owner relays between the two repos.

## The two files that matter

| File | Role |
|------|------|
| `api-spec.yaml` | **Canonical HTTP contract.** Single source of truth. Do not deviate. |
| `my-tools-prd.md` | Implementation guide: stack, pipeline, deployment, acceptance. |

> These live in the `appai` repo under `docs/video-subtitle/`. Copy both
> into this repo (suggested: `services/video-subtitle/`) before starting.

## Kickoff prompt (what the owner pastes to the my-tools agent)

```
你要在這個 repo 蓋一個後端服務。完整規格在
services/video-subtitle/my-tools-prd.md，HTTP 契約在
services/video-subtitle/api-spec.yaml。

規則：
1. api-spec.yaml 是唯一的契約來源。你的實作必須通過
   `schemathesis run services/video-subtitle/api-spec.yaml
   --base-url http://localhost:8000/v1`。不要偏離契約。
2. 目標硬體是 M4 iMac (Apple Silicon)，macOS。照 PRD 用
   mlx-whisper + native Python + launchd，不要用 Docker。
3. 分階段交付，每階段先讓我能驗證：
   - 階段一：FastAPI app + Job schema + POST /jobs（先回假資料）
     + GET /jobs/{id}（假狀態循環）。讓前端能先接上。
   - 階段二：接 yt-dlp + mlx-whisper，transcribe job 回真字幕。
   - 階段三：接 FFmpeg + libass + pysubs2，render job 回真 mp4。
   - 階段四：rate limit、TTL 清理、cloudflared tunnel 上線。
4. 密鑰放 .env（gitignore），絕不 commit。
5. 做完階段一就告訴我怎麼啟動本機測試。

先讀那兩個檔案，列出實作計畫給我確認，再開工。
```

## Sync checkpoints (owner relays these back to the appai side)

| When | Tell the appai/frontend side |
|------|------------------------------|
| Stage 1 done (stub endpoints up) | The base URL, so the frontend can point at it and test polling. |
| Stage 3 done (real mp4) | Trigger an end-to-end smoke test (5-min YouTube → burned mp4). |
| Either side wants to change `api-spec.yaml` | STOP. The spec is owned by the appai repo. Propose the change there, update the spec, re-copy to my-tools. Never edit the contract one-sidedly. |

## Hard rules

1. `api-spec.yaml` in the **appai repo is authoritative**; the copy here is
   a mirror. Keep them identical.
2. No Docker — Docker on macOS can't pass the Apple GPU; Whisper would lose
   Metal acceleration (the reason for using the M4).
3. Keep this repo private (yt-dlp + YouTube ToS grey area).
