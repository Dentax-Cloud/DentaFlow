# PR #16 production deploy + spot-check

- Merge: `9a7dd0b` Merge pull request #16 (includes tip `0d6170a` type fix after `ecba43a`)
- Pre-deploy main: `1ac5137`
- Rollback tags: `dentaflow-web-prod:pre-pr16-rollback` (`5f0617801187`), `dentaflow-worker-prod:pre-pr16-rollback` (`64054a3f208e`)
- Migrate: **No pending migrations to apply.** (54 found)
- Health: web healthy; `https://dentax.cloud/api/health` → `{"status":"ok","checks":{"database":"ok"}}`

## Live spot-check (Store / Nurse / Doctor)

### 1 Chair visibility + clinical denial
- Store `/inventory/chairs` loads (session 2026-08-01: no day session yet → chairs `NOT_SETUP`). Screenshot: `01-store-chair-stock.png`
- Store `/clinical/chair-setup` redirects to `/inventory`. Screenshot: `02-store-denied-clinical.png`

### 2 PO receive
- Created/received `PO-GB-0002-DXG-202608-0001` (Alginate ×2 @ 33) → status **RECEIVED**
- Item: qty **10→12→…→10** net after issue/remove; cost **32.00→33.00**
- TX: `STK-GB-0002-DXG-20260801-0001` **PURCHASE** qty=2 + audit `stock_receipt`
- Screenshot: `03-po-receive.png`

### 3 Issue + Remove
- Issue: `STK-GB-0002-DXG-20260801-0002` **USAGE** notes `issue:allocated-to-chair · to chair:Chair 1…` + audit `stock_issue`
- Quick Remove still works (USAGE notes-only, no issue prefix)
- Screenshot: `04-issue-and-remove.png`

### 4 Nurse chair-setup
- Emily Taylor, Chair Management loads at `/clinical/chair-setup`. Screenshot: `05-nurse-chair-setup.png`

### 5 Kensington spine
- Doctor Emily Green, encounter spine Harry Smith (`71bf4822-…`) ARRIVAL INTAKE stages intact. Screenshot: `06-doctor-spine.png`
