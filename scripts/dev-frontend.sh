#!/usr/bin/env bash
# Frontend dev runner with auto-restart.
# `next dev` (Turbopack) occasionally dies with a V8 out-of-memory crash on
# long sessions; this loop revives it within 2s so the page just keeps working.
# Heap is raised to 8GB to make crashes rare in the first place.
set -u

cd "$(dirname "$0")/.."

while true; do
  echo "[dev-frontend] starting next dev ($(date '+%H:%M:%S'))"
  NODE_OPTIONS="--max-old-space-size=8192" npm run dev
  code=$?
  echo "[dev-frontend] next dev exited (code $code) — restarting in 2s"
  sleep 2
done
