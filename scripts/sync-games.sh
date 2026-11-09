#!/usr/bin/env bash
# Rebuild the static game copies served at appai.info/games/<slug>/ (#64).
#
# Each game's source lives in its own folder (games/<dir> in this repo once its
# PR merges, or any checkout you pass in). This script builds it for the
# /games/<slug>/ path and replaces public/games/<slug>/ with the result.
#
#   scripts/sync-games.sh                       # all games, sources under ./games
#   scripts/sync-games.sh guess-duel ~/src/gd   # one game from another folder
#
# Vite games are built with --base=/games/<slug>/. Plain static games are
# copied as-is with a <base href="/games/<slug>/"> tag, so relative paths keep
# working whether or not the URL has a trailing slash.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/games"

# slug | default source dir (relative to repo root) | kind
GAMES=(
  "river-crossing|games/puzzle|vite"
  "guess-duel|games/guess-duel|vite"
  "werewolf|games/werewolf|static"
)

build_one() {
  local slug="$1" src="$2" kind="$3"
  if [[ ! -d "$src" ]]; then
    echo "skip $slug: no source at $src" >&2
    return 0
  fi
  local tmp
  tmp="$(mktemp -d)"
  # Clean up on any failure below (set -e exits the script).
  trap 'rm -rf "$tmp"' EXIT
  case "$kind" in
    vite)
      (cd "$src" && npm ci --silent && npx vite build --base="/games/$slug/" --outDir "$tmp" --emptyOutDir >/dev/null)
      ;;
    static)
      cp "$src/index.html" "$tmp/"
      cp -R "$src/src" "$tmp/"
      # Insert <base> right after <meta charset="utf-8">; fail loudly if that did not work.
      sed -i.bak "s#<meta charset=\"utf-8\">#<meta charset=\"utf-8\">\\
  <base href=\"/games/$slug/\">#" "$tmp/index.html" && rm "$tmp/index.html.bak"
      grep -q "<base href=\"/games/$slug/\">" "$tmp/index.html" || { echo "$slug: could not insert <base> (expected <meta charset=\"utf-8\">)" >&2; exit 1; }
      ;;
  esac
  rm -rf "$OUT/$slug"
  mkdir -p "$OUT"
  mv "$tmp" "$OUT/$slug"
  trap - EXIT
  chmod 755 "$OUT/$slug"
  echo "built $slug -> public/games/$slug"
}

if [[ $# -ge 1 ]]; then
  for entry in "${GAMES[@]}"; do
    IFS='|' read -r slug dir kind <<<"$entry"
    if [[ "$slug" == "$1" ]]; then
      build_one "$slug" "${2:-$ROOT/$dir}" "$kind"
      exit 0
    fi
  done
  echo "unknown game: $1" >&2
  exit 1
fi

for entry in "${GAMES[@]}"; do
  IFS='|' read -r slug dir kind <<<"$entry"
  build_one "$slug" "$ROOT/$dir" "$kind"
done
