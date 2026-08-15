# VPS runbook — migration checksum drift after PR #2

## Background

PR #2 (`fix/migrate-deploy-barcode-scan-drift`) edited already-applied migration SQL so a greenfield `prisma migrate deploy` can succeed:

- `20260705143634_reconcile_schema_drift` — skip-safe when later tables are missing
- `20260706210000_add_payer_submission_config` — skip-safe when `TenantInsuranceProvider` is missing
- `20260712000000_add_appointment_priority` — UTF-8 BOM stripped

Prisma stores a SHA-256 of each migration file in `_prisma_migrations.checksum` when it is applied. After those files changed on disk, an environment that applied the **pre-fix** bytes will have **old** checksums while the repo has **new** file content.

## Investigation result (Prisma 6.19.3)

Against a throwaway DB that had these three migrations recorded with **pre-fix** checksums, while the working tree had the **post-fix** files:

```text
pnpm prisma migrate deploy
→ Exit 0
→ "No pending migrations to apply."
```

No hard failure. No warning was printed by `migrate deploy` / `migrate status` in this version (docs historically mention a warning for modified migrations; we did not observe one on 6.19.3).

A pending probe migration still applied cleanly with mismatched checksums present.

**Conclusion for the next VPS deploy:** `docker compose … exec web pnpm prisma migrate deploy` is **not blocked** by this drift on Prisma 6.19.3. Updating checksums is still recommended so history stays accurate for tooling / future Prisma versions.

## Before updating — inspect what the VPS actually has

Run on the VPS DB (adjust compose file / container name to match prod):

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U dentaflow -d dentaflow -c "
SELECT migration_name, checksum, finished_at
FROM _prisma_migrations
WHERE migration_name IN (
  '20260705143634_reconcile_schema_drift',
  '20260706210000_add_payer_submission_config',
  '20260712000000_add_appointment_priority'
)
ORDER BY migration_name;
"
```

Compare to:

| Migration | Pre-fix checksum (ee31edf / git blob) | Post-fix checksum (current `main` / git blob, LF) |
|---|---|---|
| `20260705143634_reconcile_schema_drift` | `6f0c204651fa69f12008c66058998fb819c48a2e501602eff785bc023b5004f4` | `6b2cfa6ebb2ca6dedccc0b5eaa17a2d3a223f383b07419780a3baf4224218806` |
| `20260706210000_add_payer_submission_config` | `d06a01e5cbe04d2d0ba771d6b7a3ea7d26e9e2136bd6929be1a017b959170d8c` | `284cd40a51bacdab9a419f91436b536868ce1cda173fdd85536e1be91655a3fd` |
| `20260712000000_add_appointment_priority` | `056429ff2edab73b68c061a6ca716d0925c83f491ba4b0317a325863005c0ba5` (file started with BOM `EF BB BF`) | `aa54b158b72a9cf7fe27d3c4fbaf42d5a384c3feaad1f53fa3796466ef0cc11d` |

Hashes above are SHA-256 of the **git blob** at the given revision (LF). On Linux containers that matches `sha256sum` of the file after checkout. Do **not** use a Windows working-tree hash if Git has rewritten CRLF.

If VPS checksums already match the post-fix column, skip the UPDATE.

## Optional / recommended: align checksums (does not re-run migrations)

Do this **before or right after** the next deploy’s `migrate deploy`. Safe: rows are already `finished`; only the stored hash is corrected.

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U dentaflow -d dentaflow <<'SQL'
BEGIN;

UPDATE "_prisma_migrations"
SET "checksum" = '6b2cfa6ebb2ca6dedccc0b5eaa17a2d3a223f383b07419780a3baf4224218806'
WHERE "migration_name" = '20260705143634_reconcile_schema_drift'
  AND "checksum" = '6f0c204651fa69f12008c66058998fb819c48a2e501602eff785bc023b5004f4';

UPDATE "_prisma_migrations"
SET "checksum" = '284cd40a51bacdab9a419f91436b536868ce1cda173fdd85536e1be91655a3fd'
WHERE "migration_name" = '20260706210000_add_payer_submission_config'
  AND "checksum" = 'd06a01e5cbe04d2d0ba771d6b7a3ea7d26e9e2136bd6929be1a017b959170d8c';

UPDATE "_prisma_migrations"
SET "checksum" = 'aa54b158b72a9cf7fe27d3c4fbaf42d5a384c3feaad1f53fa3796466ef0cc11d'
WHERE "migration_name" = '20260712000000_add_appointment_priority'
  AND "checksum" = '056429ff2edab73b68c061a6ca716d0925c83f491ba4b0317a325863005c0ba5';

SELECT migration_name, checksum FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260705143634_reconcile_schema_drift',
  '20260706210000_add_payer_submission_config',
  '20260712000000_add_appointment_priority'
)
ORDER BY 1;

COMMIT;
SQL
```

The `AND "checksum" = '<old>'` guards are intentional: if a row was never applied, or already updated, the UPDATE affects 0 rows.

Then the usual deploy step:

```bash
docker compose -f docker-compose.prod.yml exec web pnpm prisma migrate deploy
```

Expected: exit 0; either pending Module 6 / other migrations apply, or “No pending migrations”.

## What not to do

- Do **not** `migrate resolve --rolled-back` / re-apply these three migrations.
- Do **not** reset the production database.
- Do **not** edit the SQL back to the pre-fix versions.

## How this was reproduced (local throwaway)

1. Local Postgres on `127.0.0.1:5435` (no out-of-project Docker).
2. `CREATE DATABASE dentaflow_checksum_test`; `migrate deploy` with current `main` (new checksums recorded).
3. `UPDATE` those three rows to pre-fix checksums from `ee31edf` blobs.
4. `migrate deploy` again (LF files and CRLF Windows WT both tested) → exit 0, no pending.
5. `UPDATE` to post-fix LF checksums → `migrate deploy` exit 0 again.
