# Phase 3a review caveats — closed

Branch tip at live proof: `b8ec973` image (`dentaflow-phase3a-review:latest`) + isolation test added on the PR branch.

## Step 1 — NURSE action isolation

`src/tests/encounter-spine-phase3a-nurse-isolation.test.ts`

```
✓ src/tests/encounter-spine-phase3a-nurse-isolation.test.ts (9 tests)
Test Files  41 passed (41)
     Tests  267 passed (267)
```

NURSE: `clearSpineRisk`, `grantSpineConsent`, `completeSpineExam`, `overrideSpinePreAuth`, tracked `logSpineMaterial` → `FORBIDDEN`.
NURSE: consumable `logSpineMaterial` → `{ ok: true }`.
DENTIST + ADMIN controls: all of the above succeed, including both material tiers.

## Step 2 — Live nurse consumable log

Disposable: `dentaflow-phase3a-nurse-web` @ `127.0.0.1:3651`, DB `dentaflow_phase3a_nurse` (prod clone). Seeded `Amoxicillin 500mg` to `defaultTier=consumable` with stock 25. Prod `dentaflow-web-prod` remained healthy.

Nurse dropdown offered Amoxicillin; tracked `Alginate Impression Material` was absent.

`MaterialUsage` row (pipe-delimited from report.json):

```
id=cmsv5usfw001cpf3nvpyi1b1a
tenantId=cmr5s7yim01oyo99g7qqthydd
procedureLineId=cmsv5ugs60014pf3nnxtcy4bd
itemId=cmr5s80bv01rvo99g9eu54cnu
tier=consumable
quantity=1.0000
status=used
item=Amoxicillin 500mg
appointmentId=phase3a_nurse_caveat_appt
line_status=in_progress
```

Stock after log: Amoxicillin quantity 24 (was 25).

Screenshot: `02-nurse-logged-consumable.png`
