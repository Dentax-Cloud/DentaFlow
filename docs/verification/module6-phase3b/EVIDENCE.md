# Module 6 Phase 3b — live click-test evidence

- Branch: `feature/module6-phase3b-consent-verification` off `main` at `7c2c262`
- Disposable stack: `docker-compose.phase3b-clicktest.yml` → `dentaflow-phase3b-clicktest-db` on `127.0.0.1:5438`
- Next: `pnpm exec next dev -p 3652` (`http://localhost:3652` only — `127.0.0.1` blocked `_next` as cross-origin)
- Machine summary: `report.json` → `"ok": true`
- Hydration warnings: **[]** (zero) on visit, flag-off, and spine

Seeded tenants: `phase3b-on` (spine flag ON) and `phase3b-off` (flag OFF). Password `Test1234!`.

## Task 3 recon (consent purpose)

`ConsentRecord.purpose` (`clinical` | `marketing`) is **partially enforced**:

- **Enforced** for encounter clinical gates (`src/lib/encounter/gates/consent.ts` and lifecycle/gate-enforcement filters `purpose: "clinical"`).
- **Unused** for image/document sharing: `/plan/[token]` has no images; `/case/[token]` shares photos with **no** purpose check; CRM does not attach clinical images.
- **No marketing-sharing surface exists** — this phase does not invent one.
- Patient visit display uses **clinical** consent only. Marketing consent is not a substitute. Photos on `/visit/[token]` require `ClinicalImage.patientShareable` **and** active clinical consent.

Nurse: `/visit/[token]` is public. Co-sign is provider-only (`DOCTOR` / `DENTIST` / `OWNER` / `ADMIN` / `MANAGER`). `NURSE` has `clinical_chart.read` only and cannot generate visit links or co-sign.

Anaesthesia tagging uses existing `ProcedureCatalog.category` (`ANAESTHESIA`; also `ANESTHESIA` / `SEDATION`). No new catalog field.

## Flag OFF

Screenshot: `01-flag-off.png`

| Check | Result |
|--------|--------|
| `/visit/{d×32}` (flag-off tenant token) | **404** |
| `/clinical/encounter/appt_p3b_off/spine` | Redirects to legacy `/clinical/encounter/appt_p3b_off` |
| Patient visit view / co-sign | Absent on legacy chart |

## Public visit view (flag ON)

Screenshot: `02-visit-patient-view.png`

| Check | Result |
|--------|--------|
| `/visit/{b×32}` | **200**, “Prepared for Harry Visit” |
| Clinical treatment consent | Granted |
| Marketing photo use | Pending (not used as a substitute) |
| Running estimate | D1110 Prophylaxis · GBP 80.00 |
| Shareable photo | Shown (`patientShareable: true`) |
| `private-xray-leak.png` | Hidden |
| Other-patient photo | Hidden |
| `/visit/{c×32}` expired | **404** |

## Flag ON — spine + co-sign (owner)

Screenshots: `03-spine-flag-on.png`, `04-cosign-dialog.png`, `05-cosign-same-user-rejected.png`, `06-cosign-two-providers.png`

| Check | Result |
|--------|--------|
| Patient visit view button | Visible |
| Complete AN001 | Opens “Second provider co-sign” |
| Same-user credentials (`owner.phase3b@…`) | Rejected: “The co-sign must be a different provider…” |
| Second provider (`doctor.b.phase3b@…`) | “Procedure completed with co-sign”; `line_p3b_anaes_1` → `completed` |
| Audit | `AuditLog.metadata.kind = "anaesthesia_cosign"` · actor `staff_p3b_owner` · co-sign `staff_p3b_doc_b` |

## Screenshots required by prompt

1. Flag-off legacy encounter → `01-flag-off.png`
2. Patient visit view → `02-visit-patient-view.png`
3. Spine with visit button → `03-spine-flag-on.png`
4. Co-sign dialog → `04-cosign-dialog.png`
5. Same-user rejected → `05-cosign-same-user-rejected.png`
6. Two-provider success → `06-cosign-two-providers.png`
