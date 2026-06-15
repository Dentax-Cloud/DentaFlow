# DentaFlow

Production-ready, multi-tenant **Dental Clinic Management SaaS** built with Next.js 15, TypeScript, Prisma, Clerk, Stripe, and Vercel AI SDK.

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
| Auth | Clerk (organizations = tenants) |
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

Copy and edit the Docker env file:

```bash
cp .env.docker .env.docker
```

Then fill in Clerk/Stripe/OpenAI/Pusher values as needed. `DATABASE_URL` is already set for Docker.

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
- Clerk application with **Organizations** enabled
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

### 3. Clerk setup

1. Enable Organizations in Clerk Dashboard.
2. Add custom roles: `org:dentist`, `org:hygienist`, `org:manager`, `org:accountant` (optional).
3. Configure webhook → `POST /api/webhooks/clerk` with `organizationMembership.created` events.
4. **Disable Web3 / MetaMask** (required for DentaFlow — we use email/password + Google only):
   - Open [Clerk Dashboard](https://dashboard.clerk.com) → select your DentaFlow application.
   - In the left sidebar, go to **Configure** → **Web3** (or **User & Authentication** → **Web3**, depending on dashboard version).
   - You should see a list of providers: **MetaMask**, **Base**, **Coinbase Wallet**, **OKX Wallet**, **Solana**.
   - Toggle **off** every Web3 provider (especially **MetaMask**). Each row shows a provider name and an enable/disable switch on the right.
   - Click **Save** if prompted.
   - **Expected result:** On `/sign-in`, the Clerk `<SignIn />` card shows only email/password and Google — no “Sign in with MetaMask” or wallet buttons. The browser console should not show “Failed to connect to MetaMask”.
   - **If the error persists:** Hard-refresh `/sign-in`, disable or lock the MetaMask browser extension temporarily, and confirm you edited the same Clerk app whose keys are in `.env`.
5. Set redirect URLs in `.env` (see `.env.example`):
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard` (registration wizard provisions the tenant and skips `/onboarding`; legacy org-only sign-ups still use `/select-org` → `/onboarding`).

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

- `getTenantContext()` resolves tenant from Clerk `orgId`.
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

## License

Private — All rights reserved.
