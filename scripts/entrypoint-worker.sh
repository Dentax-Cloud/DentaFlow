#!/bin/sh
set -e
cd /app
sh ./scripts/wait-for-db.sh
pnpm prisma generate
exec pnpm worker
