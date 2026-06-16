#!/bin/sh
set -e
cd /app
pnpm install
sh ./scripts/wait-for-db.sh
pnpm prisma generate
exec pnpm worker
