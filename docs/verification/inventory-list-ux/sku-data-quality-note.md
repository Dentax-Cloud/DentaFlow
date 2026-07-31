# Inventory list UX — SKU / barcode data-quality note

## SKU inconsistency (`TD-AMOX-ington` vs `TRAY-AMOX`)

**Not a runtime auto-SKU bug.** Two seed paths write inventory for Kensington:

1. Clinic test seed (`src/lib/seed/test-data/run-seed.ts`) creates template items with  
   `sku: \`${tmpl.sku}-${clinic.slug.slice(-6)}\``  
   → e.g. `TD-AMOX` + `ington` (from `test-gb-kensington`) = `TD-AMOX-ington`.
2. Standard tray catalog (`src/lib/chair-setup/standard-tray-catalog.ts`) upserts stable SKUs such as `TRAY-AMOX`, `TRAY-ALGINATE` without a clinic suffix.

Both “Amoxicillin…” rows are intentional seed overlap (different categories: `MEDICINE` vs `MEDICATION`), not a broken generator on create forms.

**Action for this PR:** leave existing tenant SKUs untouched; do not mass-edit production data as part of a UI task.

## GTIN / SupplierBarcode on Kensington (prod sample, 2026-07-31)

- `InventoryItem.gtin`: **0 / 94** populated.
- `SupplierBarcode` rows linked to Kensington items: **0**.

Scan-to-search reuses `scanSupplierBarcode` (GTIN + `SupplierBarcode` + existing `itemRef` fallbacks). Live verification seeds a disposable GTIN / supplier barcode on one item; it does not rewrite catalog SKUs.
