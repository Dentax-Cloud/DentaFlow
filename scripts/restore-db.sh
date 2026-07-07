#!/usr/bin/env bash
# Restore DentaFlow PostgreSQL from a gzip SQL dump (run on VPS host).
set -euo pipefail

BACKUP_DIR="${DENTAFLOW_BACKUP_DIR:-/opt/DentaFlow/backups}"
CONTAINER="${DENTAFLOW_DB_CONTAINER:-dentaflow-db}"
DB_USER="${POSTGRES_USER:-dentaflow}"
DB_NAME="${POSTGRES_DB:-dentaflow}"
TEST_DB_NAME="${DENTAFLOW_TEST_DB:-dentaflow_restore_test}"

MODE=""
INPUT=""

usage() {
  cat >&2 <<EOF
Usage:
  $0 <backup-file> --test     RECOMMENDED drill: restore into temporary database '${TEST_DB_NAME}'
  $0 <backup-file> --live     HIGH RISK: replace the live '${DB_NAME}' database

Examples:
  $0 dentaflow_20260707_020000.sql.gz --test
  $0 dentaflow_20260707_020000.sql.gz --live

Always validate backups with --test before any --live restore during a maintenance window.
EOF
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --test)
      MODE="test"
      shift
      ;;
    --live)
      MODE="live"
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      if [ -z "$INPUT" ]; then
        INPUT="$1"
        shift
      else
        usage
      fi
      ;;
  esac
done

[ -n "$INPUT" ] && [ -n "$MODE" ] || usage

if [ -f "$INPUT" ]; then
  FILE="$INPUT"
elif [ -f "${BACKUP_DIR}/${INPUT}" ]; then
  FILE="${BACKUP_DIR}/${INPUT}"
else
  echo "ERROR: Backup not found: $INPUT" >&2
  echo "Looked in cwd and ${BACKUP_DIR}/" >&2
  exit 1
fi

if ! gzip -t "$FILE" 2>/dev/null; then
  echo "ERROR: File is missing or corrupt (gzip check failed): $FILE" >&2
  exit 1
fi

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: Database container '$CONTAINER' is not running." >&2
  exit 1
fi

psql_admin() {
  docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d postgres "$@"
}

psql_db() {
  local database="$1"
  shift
  docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$database" "$@"
}

apply_backup() {
  local target_db="$1"
  echo "[restore] Applying backup to '${target_db}' (stops on first error)..."
  gunzip -c "$FILE" | docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$target_db"
}

table_count() {
  local database="$1"
  local table="$2"
  psql_db "$database" -tAc "SELECT COUNT(*) FROM \"${table}\";"
}

verify_test_counts() {
  echo "[restore:test] Verifying row counts against live '${DB_NAME}'..."
  local mismatches=0
  local tables=("Tenant" "Patient" "auth_users" "Appointment" "Invoice")

  for table in "${tables[@]}"; do
    local live_count test_count
    live_count="$(table_count "$DB_NAME" "$table" | tr -d '[:space:]')"
    test_count="$(table_count "$TEST_DB_NAME" "$table" | tr -d '[:space:]')"

    if [ "$live_count" != "$test_count" ]; then
      echo "ERROR: Row count mismatch for ${table}: live=${live_count}, test=${test_count}" >&2
      mismatches=$((mismatches + 1))
    else
      echo "[restore:test] ${table}: ${live_count} rows (match)"
    fi
  done

  if [ "$mismatches" -gt 0 ]; then
    echo "ERROR: Restore test finished with ${mismatches} table count mismatch(es)." >&2
    exit 1
  fi

  echo "[restore:test] Row-count verification passed."
}

if [ "$MODE" = "test" ]; then
  echo "[restore:test] Safe drill mode — target database: ${TEST_DB_NAME}"
  echo "[restore:test] Backup file: $FILE"

  echo "[restore:test] Recreating temporary database..."
  psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
  psql_admin -c "DROP DATABASE IF EXISTS \"${TEST_DB_NAME}\";"
  psql_admin -c "CREATE DATABASE \"${TEST_DB_NAME}\";"

  apply_backup "$TEST_DB_NAME"
  verify_test_counts

  echo "[restore:test] Success. Temporary database '${TEST_DB_NAME}' is ready for inspection."
  echo "[restore:test] Drop it when finished: psql -d postgres -c 'DROP DATABASE \"${TEST_DB_NAME}\";'"
  exit 0
fi

echo "WARNING: HIGH RISK — this will replace ALL data in the LIVE database '${DB_NAME}'."
echo "Backup file: $FILE"
echo "Stop web/worker containers first if users are active."
echo "Recommended: run with --test and confirm zero errors before attempting --live."
read -r -p "Type RESTORE LIVE to continue: " CONFIRM
if [ "$CONFIRM" != "RESTORE LIVE" ]; then
  echo "Aborted."
  exit 1
fi

apply_backup "$DB_NAME"
echo "[restore:live] Done. Verify the application and run smoke tests."
