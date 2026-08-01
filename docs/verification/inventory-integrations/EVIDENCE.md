# Inventory Integrations — disposable click-test evidence

- Stack: `dentaflow-pr14-store-clicktest-web` on `127.0.0.1:3630` (image `dentaflow-inv-int-clicktest:latest`)
- Branch tip: `9b1c229` (+ follow-up PO create UI refresh)
- DB: `dentaflow_pr14_store_clicktest` (prod snapshot; no new migrations)
- Store user: `store.gb.kensington@test.dentaflow.io`
- Nurse user: `nurse.gb.kensington@test.dentaflow.io`

## Task 1 — Chair visibility

- Store `/inventory/chairs` shows live ChairDaySetup trays (session `2026-07-31`, 2 setups). Screenshot: `01-store-chair-stock.png`
- Store navigating to `/clinical/chair-setup` is redirected to role home `/inventory` (`requireRouteAccess` → `getRoleHomePath`). Confirmed via browser URL after navigation.
- Nurse `/clinical/chair-setup` still loads Chair Management. Screenshot: `05-nurse-chair-setup-regression.png`

## Task 2 — Stock receipt

Created `PO-GB-0002-DXG-202607-0001` (Alginate ×5 @ 35), received qty 2:

```
ITEM: TRAY-ALGINATE quantity=16 cost=35.00  (was 15 / 32.00 before receive; then −1 issue)
PO:   PARTIALLY_RECEIVED ordered=5 received=2 unitCost=35.00
TX:   STK-GB-0002-DXG-20260731-0018 PURCHASE qty=2 purchaseOrderId set
AUDIT: kind=stock_receipt
```

Screenshot: `03-po-partial-receive.png` (PO card after receive). Cost policy: most-recent-received unit cost.

## Task 3 — Issue stock

Formal issue of Alginate ×1 to Chair 1, reason `allocated-to-chair`:

```
TX: STK-GB-0002-DXG-20260731-0019 USAGE qty=1
notes: issue:allocated-to-chair · to chair:Chair 1 (Chair 1)
chairId: cmr5s808501qdo99g4ef4hf9t
AUDIT: kind=stock_issue
```

Quick Remove still works (ad-hoc USAGE, notes-only, no `issue:` prefix / no audit kind). Final qty=15. Screenshot: `04-issue-and-remove-buttons.png`

## Regressions

- Nurse chair-setup OK (above)
- PO list/create still available; new receive is additive
- Spine `MaterialUsage` path not modified (`deduct-store-stock.ts` unchanged by this work)
- `git diff main...HEAD -- prisma/schema.prisma prisma/migrations` empty (permission-matrix only)
