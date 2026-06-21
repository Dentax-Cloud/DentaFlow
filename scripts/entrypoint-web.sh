#!/bin/sh
set -e
cd /app

echo "Validating environment variables..."

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
else
  echo "  OK: DATABASE_URL"
fi

# Optional services — warn but don't block
for var in STRIPE_SECRET_KEY OPENAI_API_KEY PUSHER_APP_ID PUSHER_SECRET NEXT_PUBLIC_PUSHER_KEY NEXT_PUBLIC_PUSHER_CLUSTER UPLOADTHING_TOKEN; do
  eval "val=\$$var"
  if [ -z "$val" ]; then
    echo "  WARN: $var not set — related features disabled"
  else
    echo "  OK: $var"
  fi
done

if [ -z "$AUTH_SECRET" ]; then
  echo "  WARN: AUTH_SECRET not set"
else
  echo "  OK: AUTH_SECRET"
fi

if [ -z "$NEXTAUTH_URL" ]; then
  echo "  WARN: NEXTAUTH_URL not set"
else
  echo "  OK: NEXTAUTH_URL"
fi

echo "Installing dependencies..."
pnpm install
sh ./scripts/wait-for-db.sh
pnpm prisma generate
exec pnpm dev
