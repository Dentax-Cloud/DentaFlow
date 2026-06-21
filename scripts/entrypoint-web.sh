#!/bin/sh
# scripts/entrypoint-web.sh
#
# FIX B8: Stripe, OpenAI, Pusher are OPTIONAL in development.
# Only DATABASE_URL, NEXTAUTH_URL, and an auth secret are truly required.
# Services fail gracefully if keys are missing rather than killing startup.

set -e
cd /app

echo "🦷 DentaFlow web service starting..."

# ── Required in all environments ────────────────────────────
MISSING=""
for VAR in DATABASE_URL NEXTAUTH_URL; do
  eval "val=\$$VAR"
  if [ -z "$val" ]; then
    MISSING="$MISSING $VAR"
  fi
done

if [ -z "$AUTH_SECRET" ] && [ -z "$NEXTAUTH_SECRET" ]; then
  MISSING="$MISSING AUTH_SECRET(or NEXTAUTH_SECRET)"
fi

if [ -n "$MISSING" ]; then
  echo "❌ ERROR: Required environment variables are not set:$MISSING" >&2
  echo "" >&2
  echo "Set them in .env.docker or the docker-compose environment section." >&2
  exit 1
fi

# ── Optional services — warn but don't block ─────────────────
warn_missing() {
  echo "⚠️  $1 not set — $2 will be disabled"
}

if [ -z "$STRIPE_SECRET_KEY" ]; then
  warn_missing "STRIPE_SECRET_KEY" "Billing/subscriptions"
fi

if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
  warn_missing "STRIPE_WEBHOOK_SECRET" "Stripe webhook verification"
fi

if [ -z "$OPENAI_API_KEY" ]; then
  warn_missing "OPENAI_API_KEY" "AI assistant"
fi

if [ -z "$PUSHER_APP_ID" ] || [ -z "$PUSHER_SECRET" ]; then
  warn_missing "PUSHER_APP_ID / PUSHER_SECRET" "Real-time notifications"
fi

if [ -z "$NEXT_PUBLIC_PUSHER_KEY" ] || [ -z "$NEXT_PUBLIC_PUSHER_CLUSTER" ]; then
  warn_missing "NEXT_PUBLIC_PUSHER_KEY / NEXT_PUBLIC_PUSHER_CLUSTER" "Pusher client"
fi

if [ -z "$UPLOADTHING_TOKEN" ]; then
  warn_missing "UPLOADTHING_TOKEN" "File uploads"
fi

echo "Installing dependencies (sync with bind-mounted package.json)..."
pnpm install

echo "⏳ Waiting for database..."
sh ./scripts/wait-for-db.sh

echo "📦 Running Prisma migrations..."
pnpm prisma migrate deploy

echo "⚙️  Generating Prisma client..."
pnpm prisma generate

echo "🚀 Starting Next.js..."
if [ $# -gt 0 ]; then
  exec "$@"
fi
exec pnpm dev
