# Module 6 Phase 2 verification tooling

Reusable local scripts for PR #4 / VPS re-checks. Outputs land in `tmp-phase2-clicktest/` (gitignored).

These scripts are **not** part of the Next.js app build (`scripts/` is excluded in `tsconfig.json`). Playwright is not a package dependency — install it locally before running click-tests:

```bash
pnpm add -D playwright
# optional: install browsers if needed
pnpm exec playwright install chromium
```

## Fixtures

```bash
psql -h 127.0.0.1 -p 5435 -U dentaflow -d dentaflow -f scripts/phase2-fixtures.sql
```

Seeds `seed_appt_spine_phase2`, `seed_appt_flagoff_phase2`, and inventory material `inv_spine_composite`.

## Flag ON (spine billing UI)

```bash
# Next must be running with DATABASE_URL pointing at the test DB
pnpm exec tsx scripts/phase2-flag-on-ui-clicktest.ts
```

## Flag OFF (classic chairside)

Requires `ENCOUNTER_SPINE_ENABLED` ≠ `true` **and** empty tenant `featureFlags`.

```bash
pnpm exec tsx scripts/phase2-flag-off-ui-clicktest.ts
```

## Migrations

```bash
pnpm exec tsx scripts/phase2-verify-migrations.ts   # BOM check
pnpm exec prisma migrate deploy                     # against target DATABASE_URL
```

## Mail / Mailhog (VPS test runbook)

`getMailTransporter()` (`src/lib/mail/send.ts`) resolves settings via `getSetting()` which reads **PlatformSetting DB first**, then env fallbacks:

| Setting key | Env fallback | Notes |
|---|---|---|
| `SMTP_HOST` | `SMTP_HOST` | If set (DB or env), uses this host — not the Mailhog shortcut |
| `SMTP_PORT` | `SMTP_PORT` | Default parse `587` when using explicit SMTP path |
| `SMTP_USER` | `SMTP_USER` | Optional auth |
| `SMTP_PASSWORD` | `SMTP_PASSWORD` | Optional auth |
| `SMTP_FROM_EMAIL` | `SMTP_FROM` | From address |
| `SMTP_FROM_NAME` | `SMTP_FROM_NAME` | Display name |
| `EMAIL_ENABLED` | *(none)* | DB-only; `"false"` disables SMTP path |

Mailhog fallback path (host `MAILHOG_HOST` default `mailhog`, port **1025**) only runs when **`SMTP_HOST` is empty** *or* `EMAIL_ENABLED === "false"`, **and** `NODE_ENV=development` **or** `USE_MAILHOG=true`.

To divert VPS test mail to Mailhog (`dentaflow-mailhog:1025`):

1. Prefer explicit SMTP: clear conflicting DB `PlatformSetting` rows for `SMTP_*`, then set  
   `SMTP_HOST=dentaflow-mailhog` `SMTP_PORT=1025` (no auth).  
2. Or: set DB `EMAIL_ENABLED=false` (or empty `SMTP_HOST`) and `USE_MAILHOG=true` `MAILHOG_HOST=dentaflow-mailhog`.

Env-only `SMTP_HOST=…` is ignored if a non-empty DB `PlatformSetting` for that key exists.
