# Inventory item photos

## What shipped

- Schema: nullable `InventoryItem.imageUrl` (`20260930000000_inventory_item_image_url`)
- UploadThing route: `inventoryItemImage` (JPEG/PNG, 4MB) — gated on `PERMISSIONS.inventory.write` (`inventory:write`)
- Persist action: `setInventoryItemImageUrl` (tenant-scoped + audited UPDATE)
- UI: package placeholder / real thumb on list card + table leading cell + detail; upload control on detail Overview

## Roles

| Role | `inventory.write` | Upload control |
|------|-------------------|----------------|
| STORE / ADMIN / OWNER | yes | visible |
| DOCTOR | no | hidden |

## Live disposable (`dentaflow-inv-photo-clicktest-web:3660`, tip `bae5ecb`)

- Store uploaded a real PNG via UploadThing → `ufs.sh` URL persisted
- Card + table show photo + placeholder mix
- Doctor: no file input
- `/inventory/chairs` → 200

See `report.json` + screenshots in this folder.

## Verification

- `pnpm build` exit 0
- `pnpm test` 219/219 (includes 6 new image tests)
- Migration from-empty + against main-head clone: OK
