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
