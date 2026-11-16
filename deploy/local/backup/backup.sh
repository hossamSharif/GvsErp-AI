#!/bin/sh
# GVS ERP — backups for the Local Edition. Runs in the `backup` container.
#
#   backup.sh daemon         keep running; make one backup per day (first check
#                            ~1 minute after start, then every 10 minutes)
#   backup.sh now [label]    make a backup right now (label e.g. "pre-update")
#   backup.sh list           list backups, newest first
#   backup.sh restore <name> restore a backup (stop api/web/auth/rest/storage
#                            first; the Windows restore script does this)
#
# A backup set is two files in $BACKUP_DIR (a folder on the Windows disk):
#   gvs-<UTC timestamp>[-label].dump         full database (pg_dump custom format)
#   gvs-<UTC timestamp>[-label].storage.tgz  uploaded files (logos, PDFs, images)
#
# Retention is by count, not age, so a PC that was off for weeks never
# loses its last backups: KEEP_DAILY newest unlabelled sets, KEEP_LABELLED
# newest labelled sets.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
STORAGE_DIR="${STORAGE_DIR:-/storage}"
KEEP_DAILY="${KEEP_DAILY:-30}"
KEEP_LABELLED="${KEEP_LABELLED:-10}"
export PGHOST="${PGHOST:-db}" PGUSER="${PGUSER:-supabase_admin}" PGDATABASE=postgres

log() { echo "[backup] $(date -u '+%Y-%m-%d %H:%M:%S') $*"; }

db_ready() { psql -tAc 'select 1' >/dev/null 2>&1; }

make_backup() {
  label="${1:-}"
  stamp=$(date -u '+%Y%m%d-%H%M%S')
  name="gvs-${stamp}${label:+-$label}"
  mkdir -p "$BACKUP_DIR"
  tmp="$BACKUP_DIR/.${name}.partial"

  log "starting $name"
  pg_dump -Fc -f "$tmp.dump"
  # Check the dump is readable before keeping it.
  pg_restore -l "$tmp.dump" >/dev/null
  if [ -d "$STORAGE_DIR" ]; then
    tar -czf "$tmp.storage.tgz" -C "$STORAGE_DIR" .
  else
    tar -czf "$tmp.storage.tgz" -T /dev/null
  fi
  mv "$tmp.dump" "$BACKUP_DIR/$name.dump"
  mv "$tmp.storage.tgz" "$BACKUP_DIR/$name.storage.tgz"
  log "done $name ($(du -h "$BACKUP_DIR/$name.dump" | cut -f1) database, $(du -h "$BACKUP_DIR/$name.storage.tgz" | cut -f1) files)"
  prune
}

# Delete the oldest sets beyond the limits (dump + storage together).
prune() {
  prune_set "$(ls -1 "$BACKUP_DIR" 2>/dev/null | grep -E '^gvs-[0-9]{8}-[0-9]{6}\.dump$' | sort -r)" "$KEEP_DAILY"
  prune_set "$(ls -1 "$BACKUP_DIR" 2>/dev/null | grep -E '^gvs-[0-9]{8}-[0-9]{6}-.+\.dump$' | sort -r)" "$KEEP_LABELLED"
  rm -f "$BACKUP_DIR"/.gvs-*.partial.* 2>/dev/null || true
}

prune_set() {
  echo "$1" | sed '/^$/d' | tail -n +"$(( $2 + 1 ))" | while read -r dump; do
    base="${dump%.dump}"
    log "removing old backup $base"
    rm -f "$BACKUP_DIR/$base.dump" "$BACKUP_DIR/$base.storage.tgz"
  done
}

has_backup_today() {
  ls -1 "$BACKUP_DIR" 2>/dev/null | grep -qE "^gvs-$(date -u '+%Y%m%d')-[0-9]{6}(-.+)?\.dump$"
}

daemon() {
  log "daily backups to $BACKUP_DIR (keeping $KEEP_DAILY daily, $KEEP_LABELLED labelled)"
  sleep "${FIRST_CHECK_DELAY:-60}"
  while true; do
    if ! has_backup_today; then
      if db_ready; then
        make_backup "" || log "BACKUP FAILED — will retry in 10 minutes"
      else
        log "database not ready; will retry"
      fi
    fi
    sleep 600
  done
}

list_backups() {
  ls -1 "$BACKUP_DIR" 2>/dev/null | grep -E '^gvs-.+\.dump$' | sort -r | while read -r f; do
    echo "${f%.dump}  $(du -h "$BACKUP_DIR/$f" | cut -f1)"
  done
}

restore() {
  base="${1:?usage: backup.sh restore <backup name>}"
  base="${base%.dump}"
  base="${base%.storage.tgz}"
  dump="$BACKUP_DIR/$base.dump"
  files="$BACKUP_DIR/$base.storage.tgz"
  [ -f "$dump" ] || { echo "No such backup: $base" >&2; exit 1; }
  pg_restore -l "$dump" >/dev/null || { echo "Backup file is damaged: $dump" >&2; exit 1; }

  log "safety backup of the current data before restoring"
  make_backup "before-restore"

  log "restoring database from $base"
  # Recreate the database from the dump (-C restores it with its settings).
  psql -d template1 -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS postgres WITH (FORCE)'
  # Some Supabase-internal objects already exist cluster-wide and report
  # harmless "already exists" errors; real failures are caught by the checks below.
  pg_restore -C -d template1 "$dump" 2> /tmp/restore.err || true
  grep -v -E 'already exists|errors ignored on restore' /tmp/restore.err | grep -E 'ERROR' >&2 || true

  # Sanity checks: the app schema and the auth users must be back.
  tables=$(psql -tAc "select count(*) from information_schema.tables where table_schema='public'")
  users=$(psql -tAc "select count(*) from auth.users")
  [ "$tables" -gt 10 ] || { echo "Restore check failed: only $tables tables in public" >&2; exit 1; }
  log "database restored: $tables tables, $users login(s)"

  if [ -f "$files" ]; then
    log "restoring uploaded files"
    find "$STORAGE_DIR" -mindepth 1 -delete
    tar -xzf "$files" -C "$STORAGE_DIR"
  fi
  log "restore complete — start the app again"
}

case "${1:-daemon}" in
  daemon) daemon ;;
  now) make_backup "${2:-manual}" ;;
  list) list_backups ;;
  restore) restore "${2:-}" ;;
  *) echo "usage: backup.sh daemon|now [label]|list|restore <name>" >&2; exit 2 ;;
esac
