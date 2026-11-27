#!/usr/bin/env bash
# Move the AppAI database from Neon to a Supabase project (#92-F).
#
# Run on a trusted local machine, one step at a time, in this order:
#   check -> freeze -> dump -> restore -> lockdown -> verify   (then switch Vercel env)
#   unfreeze only if you roll back before switching.
#
# Required environment (never commit these, never paste them into chat/logs):
#   SOURCE_DATABASE_URL  Neon *unpooled* URL (the current DATABASE_URL_UNPOOLED)
#   TARGET_DATABASE_URL  Supabase session-mode URL (pooler port 5432) or direct URL
# Optional:
#   WORKDIR              where the dump is written (default ./db-move-work, git-ignored)
#   PG_DOCKER_IMAGE      used when pg_dump/pg_restore/psql are not installed (default postgres:17)
#   ALLOW_NONEMPTY_TARGET=1  restore even if the target public schema already has tables
#
# The script never prints connection strings. Only public-schema objects are moved;
# Universal App schemas/roles (app_*) are listed by `check` and must be re-provisioned.
set -euo pipefail

STEP="${1:-}"
WORKDIR="${WORKDIR:-$(pwd)/db-move-work}"
DUMP="$WORKDIR/appai-public.dump"
IMAGE="${PG_DOCKER_IMAGE:-postgres:17}"

die() { echo "ERROR: $*" >&2; exit 1; }
need_src() { [[ -n "${SOURCE_DATABASE_URL:-}" ]] || die "SOURCE_DATABASE_URL is not set"; }
need_dst() { [[ -n "${TARGET_DATABASE_URL:-}" ]] || die "TARGET_DATABASE_URL is not set"; }

# Run a Postgres client tool locally, or through Docker when it is not installed.
pgtool() {
  local tool="$1"; shift
  if command -v "$tool" >/dev/null 2>&1; then
    "$tool" "$@"
  else
    command -v docker >/dev/null 2>&1 || die "$tool not found and Docker is not available (brew install libpq, or install Docker)"
    mkdir -p "$WORKDIR"
    docker run --rm -i -v "$WORKDIR:$WORKDIR" -w "$WORKDIR" "$IMAGE" "$tool" "$@"
  fi
}

q() { # q <url> <sql> : tab-separated, no headers
  pgtool psql "$1" -X -v ON_ERROR_STOP=1 -At -F $'\t' -c "$2"
}

COUNT_SQL="SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text::bigint
FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

case "$STEP" in
  check)
    need_src; need_dst
    echo "== source (Neon)";   q "$SOURCE_DATABASE_URL" "SHOW server_version;"
    echo "   public tables:";  q "$SOURCE_DATABASE_URL" "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
    echo "   database size:";  q "$SOURCE_DATABASE_URL" "SELECT pg_size_pretty(pg_database_size(current_database()));"
    echo "   extensions:";     q "$SOURCE_DATABASE_URL" "SELECT extname FROM pg_extension WHERE extname <> 'plpgsql' ORDER BY 1;"
    echo "   non-public schemas (NOT moved by this script; Universal App data lives here):"
    q "$SOURCE_DATABASE_URL" "SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg\_%' AND nspname NOT LIKE 'neon%' ORDER BY 1;"
    echo "== target (Supabase)"; q "$TARGET_DATABASE_URL" "SHOW server_version;"
    echo "   public tables (should be 0 before restore):"
    q "$TARGET_DATABASE_URL" "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
    echo "   connected as:";   q "$TARGET_DATABASE_URL" "SELECT current_user, rolcreaterole FROM pg_roles WHERE rolname = current_user;"
    echo "Client version: $(pgtool pg_dump --version)"
    ;;

  freeze)
    # Reversible write freeze: new sessions on Neon become read-only. Public pages keep
    # reading; publishing/login writes fail until the switch. Undo with `unfreeze`.
    need_src
    q "$SOURCE_DATABASE_URL" "DO \$\$ BEGIN EXECUTE format('ALTER DATABASE %I SET default_transaction_read_only = on', current_database()); END \$\$;"
    q "$SOURCE_DATABASE_URL" "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND usename = current_user;" >/dev/null || true
    echo "Neon is now read-only for new sessions. Wait ~1 minute for open connections to recycle, then run: dump"
    ;;

  unfreeze)
    need_src
    # Separate -c commands: the first leaves the session's read-only default before ALTER runs.
    pgtool psql "$SOURCE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -q -c "SET default_transaction_read_only = off;" \
      -c "DO \$\$ BEGIN EXECUTE format('ALTER DATABASE %I SET default_transaction_read_only = off', current_database()); END \$\$;"
    echo "Neon accepts writes again."
    ;;

  dump)
    need_src
    mkdir -p "$WORKDIR"; chmod 700 "$WORKDIR"
    pgtool pg_dump "$SOURCE_DATABASE_URL" --format=custom --schema=public --no-owner --no-acl --file="$DUMP"
    pgtool pg_restore --list "$DUMP" > "$WORKDIR/dump.list"
    echo "Dump written: $DUMP ($(du -h "$DUMP" | cut -f1)), $(grep -c ' TABLE DATA ' "$WORKDIR/dump.list") tables with data"
    q "$SOURCE_DATABASE_URL" "$COUNT_SQL" > "$WORKDIR/source-counts.tsv"
    echo "Source row counts saved: $WORKDIR/source-counts.tsv"
    ;;

  restore)
    need_dst
    [[ -f "$DUMP" ]] || die "no dump at $DUMP (run: dump)"
    existing="$(q "$TARGET_DATABASE_URL" "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
    if [[ "$existing" != "0" && "${ALLOW_NONEMPTY_TARGET:-}" != "1" ]]; then
      die "target public schema already has $existing tables; refusing (set ALLOW_NONEMPTY_TARGET=1 only if you know why)"
    fi
    # Supabase already owns a `public` schema; skip the dump's own schema entry.
    grep -v -E ' SCHEMA - public | COMMENT - SCHEMA public ' "$WORKDIR/dump.list" > "$WORKDIR/restore.list"
    pgtool pg_restore --dbname="$TARGET_DATABASE_URL" --no-owner --no-acl --single-transaction \
      --exit-on-error --use-list="$WORKDIR/restore.list" "$DUMP"
    echo "Restore finished. Next: lockdown, then verify."
    ;;

  lockdown)
    need_dst
    here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    pgtool psql "$TARGET_DATABASE_URL" -X -v ON_ERROR_STOP=1 -q < "$here/supabase-lockdown.sql"
    echo "Row Level Security enabled and Data API roles revoked on all public tables."
    ;;

  verify)
    # Always re-reads both sides, so it also catches writes made after the dump.
    need_src; need_dst
    mkdir -p "$WORKDIR"
    q "$SOURCE_DATABASE_URL" "$COUNT_SQL" | LC_ALL=C sort > "$WORKDIR/verify-source.tsv"
    q "$TARGET_DATABASE_URL" "$COUNT_SQL" | LC_ALL=C sort > "$WORKDIR/verify-target.tsv"
    LC_ALL=C join -t $'\t' -a1 -a2 -e MISSING -o 0,1.2,2.2 "$WORKDIR/verify-source.tsv" "$WORKDIR/verify-target.tsv" \
      | awk -F'\t' 'BEGIN { printf "%-40s %12s %12s\n", "table", "neon", "supabase" }
          { mark = ($2 == $3) ? "" : "   <-- differs"; if (mark != "") bad++;
            printf "%-40s %12s %12s%s\n", $1, $2, $3, mark }
          END { if (bad) { print "MISMATCH: " bad " table(s) differ"; exit 1 }
                print "OK: all " NR " tables have identical row counts." }'
    ;;

  *)
    sed -n '2,18p' "$0"; exit 2 ;;
esac
