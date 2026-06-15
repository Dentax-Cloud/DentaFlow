#!/bin/sh
set -e
cd /app
sh ./scripts/wait-for-db.sh
pnpm prisma generate
exec pnpm prisma studio --hostname 0.0.0.0 --port 5555
