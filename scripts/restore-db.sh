#!/usr/bin/env bash
# Restore DentaFlow PostgreSQL from a gzip SQL dump (run on VPS host).
set -euo pipefail

BACKUP_DIR="${DENTAFLOW_BACKUP_DIR:-/opt/DentaFlow/backups}"
CONTAINER="${DENTAFLOW_DB_CONTAINER:-dentaflow-db}"
DB_USER="${POSTGRES_USER:-dentaflow}"
DB_NAME="${POSTGRES_DB:-dentaflow}"

usage() {
  echo "Usage: $0 <backup-filename-or-path>" >&2
  echo "  Example: $0 dentaflow_20260707_020000.sql.gz" >&2
  exit 1
}

[ $# -eq 1 ] || usage

INPUT="$1"
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

echo "WARNING: This will REPLACE all data in database '${DB_NAME}' on container '${CONTAINER}'."
echo "Backup file: $FILE"
echo "Stop the web/worker containers first if users are active."
read -r -p "Type RESTORE to continue: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi

echo "[restore] Applying backup..."
gunzip -c "$FILE" | docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME"
echo "[restore] Done. Verify the application and run smoke tests."
