#!/usr/bin/env bash
# Production background worker entrypoint (no bind mounts).
set -e
cd /app

echo "Validating worker environment..."
missing=""
for var in DATABASE_URL; do
  eval "val=\$$var"
  if [ -z "$val" ]; then
    missing="$missing $var"
    echo "  MISSING: $var"
  else
    echo "  OK: $var"
  fi
done

if [ -n "$missing" ]; then
  echo "ERROR: Required env vars are empty.$missing" >&2
  exit 1
fi

sh ./scripts/wait-for-db.sh
exec pnpm worker
