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

if [ -z "$SETTINGS_ENCRYPTION_KEY" ]; then
  echo "  WARN: SETTINGS_ENCRYPTION_KEY not set"
  if [ -z "$AUTH_SECRET" ]; then
    missing="$missing SETTINGS_ENCRYPTION_KEY(or AUTH_SECRET)"
    echo "  MISSING: SETTINGS_ENCRYPTION_KEY and AUTH_SECRET — cannot decrypt PlatformSetting secrets"
  else
    echo "  OK: AUTH_SECRET (fallback for settings encryption — must match dev if sharing DB)"
  fi
else
  echo "  OK: SETTINGS_ENCRYPTION_KEY"
fi

if [ -n "$missing" ]; then
  echo "ERROR: Required env vars are empty.$missing" >&2
  exit 1
fi

sh ./scripts/wait-for-db.sh
exec pnpm worker
