#!/bin/sh
set -e
cd /app

# Validate required environment (loaded from .env via docker-compose env_file)
echo "Validating environment variables..."
missing=""
for var in \
  DATABASE_URL \
  CLERK_SECRET_KEY \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
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

if [ -n "$missing" ]; then
  echo "ERROR: Required env vars are empty.$missing" >&2
  echo "Ensure .env exists in the project root and docker-compose uses env_file: [.env]" >&2
  exit 1
fi

sh ./scripts/wait-for-db.sh
pnpm prisma generate
exec pnpm dev
