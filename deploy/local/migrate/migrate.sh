#!/bin/sh
# GVS ERP — migration runner.
#
# Applies every packages/database/migrations/*.sql file that has not been
# applied yet, in filename order, each in its own transaction. Applied files
# are recorded in public.schema_migrations (filename + sha256 checksum).
#
# Environment:
#   DATABASE_URL     postgres://postgres:<password>@db:5432/postgres  (required)
#   MIGRATIONS_DIR   directory with *.sql files (default /migrations)
#   BASELINE=1       record all files as applied WITHOUT running them
#                    (for an existing database whose schema is already current)
#
# Exit code is non-zero on the first failing migration; nothing from the
# failing file is kept (single transaction).
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"
BASELINE="${BASELINE:-0}"

psql_q() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -q -t -A "$@"
}

echo "[migrate] waiting for database..."
i=0
until psql_q -c 'select 1' >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "[migrate] database not reachable after 60s" >&2
    exit 1
  fi
  sleep 1
done

psql_q <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename   TEXT PRIMARY KEY,
  checksum   TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Bookkeeping only: not exposed to the data API.
REVOKE ALL ON public.schema_migrations FROM anon, authenticated;
SQL

applied=0
skipped=0
for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  name=$(basename "$file")
  sum=$(sha256sum "$file" | cut -d' ' -f1)
  existing=$(psql_q -c "select checksum from public.schema_migrations where filename = '$name'")

  if [ -n "$existing" ]; then
    if [ "$existing" != "$sum" ]; then
      echo "[migrate] WARNING: $name changed after it was applied (checksum differs); not re-running" >&2
    fi
    skipped=$((skipped + 1))
    continue
  fi

  if [ "$BASELINE" = "1" ]; then
    echo "[migrate] baseline $name"
  else
    echo "[migrate] applying $name"
    if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -q --single-transaction -f "$file"; then
      echo "[migrate] FAILED: $name" >&2
      exit 1
    fi
  fi
  psql_q -c "insert into public.schema_migrations (filename, checksum) values ('$name', '$sum')"
  applied=$((applied + 1))
done

# Ask PostgREST to reload its schema cache so new tables/functions are visible.
psql_q -c "NOTIFY pgrst, 'reload schema'" >/dev/null

echo "[migrate] done: $applied applied, $skipped already up to date"
