# Production Dockerfile — no bind mounts; built artifact runs on VPS
FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat postgresql-client curl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .

RUN chmod +x scripts/*.sh
RUN pnpm prisma generate
RUN pnpm build

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["/bin/sh", "/app/scripts/entrypoint-prod.sh"]
