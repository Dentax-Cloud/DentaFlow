# Migration ordering repair — runbook (metadata rename)

**Status:** Verified on throwaway DBs only (`dentaflow_migrepair_fresh`, `dentaflow_migrepair_test`). **Not applied to real production `dentaflow`.**

**Branch / PR:** `fix/migration-ordering-repair`

## Problem

Folder-name order made Prisma apply MaterialUsage/ClinicalAlert **ALTERs** before Module 6 **CREATE**s:

| Applied (folder order, broken) | Depends on |
|---|---|
| `20260723090000_procedure_bom_inventory_location` | `MaterialUsage` |
| `20260723120000_bom_billable_and_item_tier` | `MaterialUsage`, `ProcedureBomItem` |
| `20260723140000_material_usage_return_to_store` | `MaterialUsage` |
| `20260731160000_clinical_alert_optional_encounter` | `ClinicalAlert` |
| `20260926000000_module6_encounter_spine` | **creates** `MaterialUsage` + `ClinicalAlert` |

Fresh `prisma migrate deploy` failed at `20260723090000_…` with `ERROR: relation "MaterialUsage" does not exist` (`42P01` / Prisma `P3018`).

Prod was fine because `_prisma_migrations` already recorded both families as applied — and real `finished_at` order was spine (2026-07-16) **before** procedure_bom (2026-07-23), i.e. not folder-name order.

## Fix (SQL content untouched)

Rename folders to timestamps **after** `20260927000000_module6_phase2_write_path`. Content/`checksum` unchanged (100% git rename).

| Old folder name | New folder name |
|---|---|
| `20260723090000_procedure_bom_inventory_location` | `20260928000000_procedure_bom_inventory_location` |
| `20260723120000_bom_billable_and_item_tier` | `20260928000001_bom_billable_and_item_tier` |
| `20260723140000_material_usage_return_to_store` | `20260928000002_material_usage_return_to_store` |
| `20260731160000_clinical_alert_optional_encounter` | `20260928000003_clinical_alert_optional_encounter` |

Why four renames (not only procedure_bom): after fixing the first failure, the next three still ALTER tables created only in `module6_encounter_spine`. End-to-end fresh migrate requires all four after spine.

## Why not edit SQL / bare rename / `migrate resolve`

- **Editing applied SQL** → checksum drift (PR #2 class of failure) on every DB that already applied the old bytes.
- **Bare folder rename without DB UPDATE** → Prisma treats new names as **pending** and tries to re-apply DDL that already exists (verified: fails on throwaway `dentaflow_migrepair_neg`).
- **`migrate resolve`** marks a migration applied/rolled back; it does not rename history entries to match moved folders.

Prisma matches history rows by `migration_name` (= folder name) and verifies `checksum` against `migration.sql` bytes. Updating **only** `migration_name` keeps checksums valid.

## Prod metadata SQL (run when deploying this PR — Step 3 recommended)

Run **once** against real prod **before** (or immediately when) the renamed folders are present in the deployed image, then `prisma migrate deploy` (expect “No pending migrations”).

Prefer **Step 3** of a deploy prompt (alongside migrate deploy), after the new image/code is on the host but **before** relying on a greenfield restore. Do **not** run this SQL before the renamed folders exist in the migration directory the deploy uses.

```sql
BEGIN;

UPDATE "_prisma_migrations"
SET "migration_name" = '20260928000000_procedure_bom_inventory_location'
WHERE "migration_name" = '20260723090000_procedure_bom_inventory_location';

UPDATE "_prisma_migrations"
SET "migration_name" = '20260928000001_bom_billable_and_item_tier'
WHERE "migration_name" = '20260723120000_bom_billable_and_item_tier';

UPDATE "_prisma_migrations"
SET "migration_name" = '20260928000002_material_usage_return_to_store'
WHERE "migration_name" = '20260723140000_material_usage_return_to_store';

UPDATE "_prisma_migrations"
SET "migration_name" = '20260928000003_clinical_alert_optional_encounter'
WHERE "migration_name" = '20260731160000_clinical_alert_optional_encounter';

-- Expect 4 rows, checksums unchanged from pre-rename values:
SELECT migration_name, checksum, finished_at
FROM "_prisma_migrations"
WHERE migration_name LIKE '20260928%'
ORDER BY migration_name;

COMMIT;
```

Expected checksums (unchanged; LF file bytes as in git):

| migration_name | checksum |
|---|---|
| `20260928000000_procedure_bom_inventory_location` | `ecea4a4b2d8834151413623bf6ddcc84a8739bd10735238808e8c6cffcc60eee` |
| `20260928000001_bom_billable_and_item_tier` | `68926a9223659c21af0fe01a636a4cbe0d74f0a6a82356f8356a0db001b7162e` |
| `20260928000002_material_usage_return_to_store` | `1bd5c35bcc402bc2738569669458d22f4480440b365062f6122eff1fb7a20a4c` |
| `20260928000003_clinical_alert_optional_encounter` | `19174c0dd4626f1aa734dbdb6a6dac0f398b7dbe1de0322575dc497620fcf086` |

Also apply the same `UPDATE` on any long-lived non-prod DB / disposable restore that already has the old `migration_name` values (or restore will look “pending” for the new folders).

## Verification already done (throwaways only)

1. **Empty DB** `dentaflow_migrepair_fresh`: pre-fix failed at `20260723090000_…` / `MaterialUsage` missing; post-fix applied all **54** migrations including the four renamed ones after spine — success.
2. **Prod snapshot** `dentaflow_migrepair_test`: after metadata `UPDATE`, `migrate deploy` → **No pending migrations to apply** (checksums retained).
3. **Negative** `dentaflow_migrepair_neg`: rename folders without `UPDATE` → deploy attempts re-apply (documents why metadata step is mandatory).

Real prod database was **not** modified in this investigation.
