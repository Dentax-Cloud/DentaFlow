#!/usr/bin/env bash
# Run on the VPS in /opt/DentaFlow — copies the settings encryption key from the
# dev stack env into .env.production so prod can decrypt shared PlatformSetting rows.
#
# Usage: ./scripts/sync-encryption-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEV_ENV="${DEV_ENV:-.env.docker}"
PROD_ENV="${PROD_ENV:-.env.production}"

if [ ! -f "$DEV_ENV" ]; then
  echo "ERROR: $DEV_ENV not found" >&2
  exit 1
fi

if [ ! -f "$PROD_ENV" ]; then
  echo "ERROR: $PROD_ENV not found — copy from .env.production.example first" >&2
  exit 1
fi

get_var() {
  local file="$1"
  local name="$2"
  grep -E "^${name}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//'
}

SETTINGS_KEY="$(get_var "$DEV_ENV" SETTINGS_ENCRYPTION_KEY)"
AUTH_DEV="$(get_var "$DEV_ENV" AUTH_SECRET)"

upsert_env_var() {
  local file="$1"
  local name="$2"
  local value="$3"
  if grep -qE "^${name}=" "$file"; then
    # shellcheck disable=SC2016
    sed -i "s|^${name}=.*|${name}=${value}|" "$file"
  else
    printf '\n%s=%s\n' "$name" "$value" >>"$file"
  fi
}

if [ -n "$SETTINGS_KEY" ]; then
  echo "Found SETTINGS_ENCRYPTION_KEY in $DEV_ENV — syncing to $PROD_ENV"
  upsert_env_var "$PROD_ENV" SETTINGS_ENCRYPTION_KEY "$SETTINGS_KEY"
  echo "Done. Recreate prod containers:"
  echo "  docker compose -f docker-compose.prod.yml up -d --force-recreate web worker"
  exit 0
fi

echo "SETTINGS_ENCRYPTION_KEY is not set in $DEV_ENV."
echo ""
echo "Platform settings were likely encrypted using AUTH_SECRET fallback (scrypt)."
echo "Production must use the SAME AUTH_SECRET as dev when sharing one database."
echo ""

if [ -z "$AUTH_DEV" ]; then
  echo "ERROR: AUTH_SECRET is also missing from $DEV_ENV" >&2
  exit 1
fi

echo "Dev AUTH_SECRET is set (value not printed). Options:"
echo "  A) If dev has SETTINGS_ENCRYPTION_KEY on the VPS, use that instead (preferred)."
echo "     grep SETTINGS_ENCRYPTION_KEY $DEV_ENV"
echo "  B) Copy dev AUTH_SECRET into $PROD_ENV — ONLY if prod AUTH_SECRET is not yet in use"
echo "     (changing AUTH_SECRET invalidates all logged-in sessions on production)."
echo "  C) Generate a new dedicated key on BOTH stacks, then re-save secrets in Superadmin:"
echo "       openssl rand -hex 32"
echo "     Add SETTINGS_ENCRYPTION_KEY=<value> to BOTH $DEV_ENV and $PROD_ENV"
echo ""
read -r -p "Copy dev AUTH_SECRET into $PROD_ENV now? [y/N] " confirm
if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
  upsert_env_var "$PROD_ENV" AUTH_SECRET "$AUTH_DEV"
  echo "AUTH_SECRET synced. Recreate prod containers:"
  echo "  docker compose -f docker-compose.prod.yml up -d --force-recreate web worker"
else
  echo "Aborted — no changes made."
  exit 1
fi
