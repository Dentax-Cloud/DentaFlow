# DentaFlow

Production-ready, multi-tenant **Dental Clinic Management SaaS** built with Next.js 15, TypeScript, Prisma, Stripe, and Vercel AI SDK.

## Features

- **Multi-tenancy** — Each clinic = one Clerk Organization = one `tenantId` on every record
- **RBAC** — Owner, Dentist, Hygienist, Receptionist, Manager, Accountant with fine-grained permissions
- **Modules** — Patients, appointments & chair board, clinical charting (FDI), billing, inventory, CRM, reports, admin
- **AI** (Professional+) — SOAP notes, treatment suggestions, no-show/churn prediction, analytics narratives, campaign templates, staff chatbot
- **Real-time** — Pusher for appointment status updates
- **Patient portal** — Separate layout for appointments, invoices, treatment summaries
- **Subscriptions** — Stripe checkout & webhooks with plan-based feature gating

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 App Router, Tailwind, shadcn-style UI, TanStack Query |
| Backend | Server Actions, Route Handlers, Prisma + PostgreSQL |
| Auth | Auth provider migration in progress (stubs in `src/lib/auth/stubs/`) |
| Billing | Stripe subscriptions |
| AI | Vercel AI SDK + OpenAI (abstracted in `/src/lib/ai/`) |
| Files | UploadThing |
| Real-time | Pusher |

## Getting started

## Docker development (one command)

This repo includes a **fully Dockerized local dev environment**. You only need Docker Desktop.

### Start everything

```bash
docker compose -f docker-compose.dev.yml up --build
```

Services started:

- **web**: Next.js dev server at `http://localhost:3100` (hot reload enabled; avoids port 3000 conflicts)
- **db**: Postgres 16 on `localhost:5432` (persistent volume)
- **studio**: Prisma Studio at `http://localhost:5555`
- **mailhog**: SMTP `localhost:1025`, UI `http://localhost:8025`
- **minio**: S3 endpoint `http://localhost:9000`, console `http://localhost:9001`
- **redis**: `localhost:6379`
- **worker**: background loop (reminders/cron placeholder)

### Environment variables

Edit `.env.docker` in the project root (loaded automatically by `docker-compose.dev.yml` for `web`, `studio`, and `worker`).

Fill in Stripe, OpenAI, and Pusher values as needed. `DATABASE_URL` is preconfigured for the Docker network (`db:5432`).

Optional NextAuth placeholders (warn-only until auth is wired):

```env
AUTH_SECRET=          # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3100
```

### Reset app dependencies or Next.js cache

After `package.json` changes, entrypoints run `pnpm install` on start. If you still see stale packages or build artifacts, recreate **app-only** named volumes (does not touch Postgres/MinIO/Redis data):

```bash
docker compose -f docker-compose.dev.yml down
docker volume rm dentaflow-dev_web_node_modules dentaflow-dev_web_next
docker compose -f docker-compose.dev.yml up --build
```

Do **not** use `docker compose down -v` unless you intend to wipe database volumes.

### Prisma in Docker

Run migrations:

```bash
docker compose -f docker-compose.dev.yml exec web pnpm prisma migrate dev
```

Generate Prisma client manually (usually done automatically on container start):

```bash
docker compose -f docker-compose.dev.yml exec web pnpm prisma generate
```

Seed demo data:

```bash
docker compose -f docker-compose.dev.yml exec web pnpm db:seed
```

### Notes on hot reload inside Docker

The dev containers set:

- `CHOKIDAR_USEPOLLING=1`
- `WATCHPACK_POLLING=true`

This ensures file watching works reliably with bind mounts on Windows/macOS.

### Troubleshooting (Windows)

If you see `set: -` or `can't execute 'bash'`:

1. Shell scripts must use **LF** line endings (see `.gitattributes`).
2. Re-checkout scripts: `git add --renormalize scripts/ && git checkout -- scripts/`
3. All containers use **`/bin/sh`** (POSIX), not bash.
4. MinIO uses **`minio/minio`** for the server and **`minio/mc`** for init (never swap them).

If MinIO image pull fails, verify tags exist:

```bash
docker pull minio/minio:RELEASE.2025-01-20T14-49-07Z
docker pull minio/mc:RELEASE.2025-01-17T23-25-50Z
```

### 1. Prerequisites

- Node.js 20+
- PostgreSQL database
- Stripe account (optional for billing)
- OpenAI API key (optional for AI)
- Pusher app (optional for real-time)

### 2. Install

```bash
cp .env.example .env.local
# Fill in all environment variables

npm install
npx prisma generate
npx prisma db push
npm run db:seed   # optional demo data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Auth

Authentication provider integration is in progress. Clerk has been removed; compile-safe stubs live in `src/lib/auth/stubs/`. Wire up your chosen provider (e.g. NextAuth) there.

### 4. Stripe setup

1. Create products/prices for Starter, Professional, Enterprise plans.
2. Set `STRIPE_PRICE_*` env vars.
3. Webhook → `POST /api/webhooks/stripe`.

## Project structure

```
src/
├── app/
│   ├── (dashboard)/          # Authenticated clinic app
│   │   ├── features/         # Co-located actions, schemas per domain
│   │   ├── dashboard/
│   │   ├── patients/
│   │   ├── appointments/
│   │   ├── clinical/
│   │   ├── billing/
│   │   └── ...
│   ├── portal/               # Patient portal (separate layout)
│   ├── onboarding/
│   └── api/                  # AI, webhooks, uploadthing
├── components/
│   ├── ui/                   # shadcn-style primitives
│   ├── clinical/             # Dental chart SVG
│   └── layout/
└── lib/
    ├── ai/                   # AI abstraction layer (required)
    ├── tenant/               # Tenant context & scoping
    ├── rbac/                 # Permissions
    └── features/             # Plan gating
```

## Multi-tenant security

- `getTenantContext()` resolves tenant from session `orgId` (auth provider TBD).
- All queries include `tenantId` via `tenantWhere()`.
- Server actions use `createAction()` with permission checks.
- Cross-tenant access is rejected at the application layer.

## AI abstraction

All AI calls go through `/src/lib/ai/`:

- `generateClinicalNotes(rawNotes)`
- `suggestTreatmentPlan(patientData, chartData)`
- `predictNoShowRisk(appointmentHistory)`
- `predictChurnRisk(patientHistory)`
- `generateAnalyticsSummary(metrics)`
- `generateCampaignTemplate(intent)`
- `chatWithStaffOrPatient(context)`

AI never gives medical advice; outputs require dentist review for clinical use.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run db:push` | Push Prisma schema |
| `npm run db:seed` | Seed demo data |
| `npm test` | Run Vitest unit tests |
| `pnpm worker` | Run background worker (dev) |

## VPS deployment (production)

1. Copy env: `cp .env.production.example .env.production` and fill values on the server.
2. Build and run: `docker compose -f docker-compose.prod.yml up --build -d`
3. Health check: `curl http://localhost:3000/api/health`

The local git repository is the single source of truth — avoid manual edits on the VPS.

### Platform settings & encryption key

On the VPS, only a **small set** of secrets belong in `.env.docker` (or `.env.production`). API keys for OpenAI, Stripe, SMTP, Twilio, and UploadThing are managed in **Superadmin → Platform Settings** and stored encrypted in the database.

Required `.env.docker` entries:

```bash
AUTH_SECRET=<your existing value>
SETTINGS_ENCRYPTION_KEY=<openssl rand -hex 32>
DATABASE_URL=<your existing value>
NEXTAUTH_URL=<your existing value>
```

Secure the env file on the server:

```bash
chmod 600 /opt/DentaFlow/.env.docker
chown root:root /opt/DentaFlow/.env.docker
```

`SETTINGS_ENCRYPTION_KEY` is separate from `AUTH_SECRET` and is used for AES-256-GCM encryption of sensitive platform settings at rest. After first deploy, open `/superadmin/settings` to configure integrations; changes take effect immediately without a restart.

Apply the platform settings migration:

```bash
docker compose -f docker-compose.prod.yml exec web pnpm prisma migrate deploy
```

## License

Private — All rights reserved.
