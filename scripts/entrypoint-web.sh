#!/bin/sh
set -e
cd /app

# Validate required environment (loaded from .env.docker via docker-compose env_file)
echo "Validating environment variables..."
missing=""
for var in \
  DATABASE_URL \
  STRIPE_SECRET_KEY \
  OPENAI_API_KEY \
  PUSHER_APP_ID \
  PUSHER_SECRET \
  NEXT_PUBLIC_PUSHER_KEY \
  NEXT_PUBLIC_PUSHER_CLUSTER
do
  eval "val=\$$var"
  if [ -z "$val" ]; then
    missing="$missing $var"
    echo "  MISSING: $var"
  else
    echo "  OK: $var"
  fi
done

if [ -z "$UPLOADTHING_TOKEN" ]; then
  echo "  WARN: UPLOADTHING_TOKEN not set — file uploads disabled"
else
  echo "  OK: UPLOADTHING_TOKEN"
fi

if [ -z "$AUTH_SECRET" ]; then
  echo "  WARN: AUTH_SECRET not set — required when NextAuth is wired up"
else
  echo "  OK: AUTH_SECRET"
fi

if [ -z "$NEXTAUTH_URL" ]; then
  echo "  WARN: NEXTAUTH_URL not set — defaults may be wrong behind Docker port mapping"
else
  echo "  OK: NEXTAUTH_URL"
fi

if [ -n "$missing" ]; then
  echo "ERROR: Required env vars are empty.$missing" >&2
  echo "Ensure .env.docker exists and docker-compose uses env_file: [.env.docker]" >&2
  exit 1
fi

echo "Installing dependencies (sync with bind-mounted package.json)..."
pnpm install

sh ./scripts/wait-for-db.sh
pnpm prisma generate
exec pnpm dev
