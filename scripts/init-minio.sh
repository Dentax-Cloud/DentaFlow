#!/bin/sh
set -e

MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"

echo "Waiting for MinIO..."
i=0
while [ "$i" -lt 60 ]; do
  if mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb -p local/dentaflow >/dev/null 2>&1 || true
mc policy set public local/dentaflow >/dev/null 2>&1 || mc anonymous set public local/dentaflow >/dev/null 2>&1 || true

echo "MinIO init complete."
