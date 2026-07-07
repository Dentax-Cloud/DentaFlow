#!/usr/bin/env bash
# Daily PostgreSQL backup for DentaFlow production (run on VPS host).
set -euo pipefail

BACKUP_DIR="${DENTAFLOW_BACKUP_DIR:-/opt/DentaFlow/backups}"
CONTAINER="${DENTAFLOW_DB_CONTAINER:-dentaflow-db}"
DB_USER="${POSTGRES_USER:-dentaflow}"
DB_NAME="${POSTGRES_DB:-dentaflow}"
KEEP_COUNT="${DENTAFLOW_BACKUP_KEEP:-14}"

mkdir -p "$BACKUP_DIR"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: Database container '$CONTAINER' is not running." >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT="${BACKUP_DIR}/dentaflow_${STAMP}.sql.gz"

echo "[backup] Dumping ${DB_NAME} from ${CONTAINER}..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip -c >"$OUT"

if ! gzip -t "$OUT" 2>/dev/null; then
  echo "ERROR: Backup file failed integrity check: $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

SIZE="$(du -h "$OUT" | awk '{print $1}')"
echo "[backup] Wrote $OUT ($SIZE)"

mapfile -t ALL_BACKUPS < <(ls -1t "${BACKUP_DIR}"/dentaflow_*.sql.gz 2>/dev/null || true)
if [ "${#ALL_BACKUPS[@]}" -gt "$KEEP_COUNT" ]; then
  for OLD in "${ALL_BACKUPS[@]:$KEEP_COUNT}"; do
    echo "[backup] Removing old backup: $OLD"
    rm -f "$OLD"
  done
fi

echo "[backup] Done. ${#ALL_BACKUPS[@]:0:$KEEP_COUNT} backup(s) retained (max $KEEP_COUNT)."
