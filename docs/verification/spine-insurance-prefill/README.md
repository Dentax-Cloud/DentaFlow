# Spine insurance form prefill (fast-follow)

Client-only fix: seed spine insurance correction fields from `InsuranceVerification[0]` instead of `EMPTY_DRAFT`.

## Environment

- Disposable: `dentaflow-phase3a-clicktest-web` @ `127.0.0.1:3650`
- Tip: `db6acf1` — `fix(module6): prefill spine insurance form from front-office verification`
- Tenant: Kensington (`test-gb-kensington`), appt `phase3a_clicktest_appt`

## Live proof

| Step | Actor | Result |
|------|--------|--------|
| FO entry | Receptionist | Eligibility **unknown**, pre-auth **approved**, coverage **850**, copay **150** |
| Spine form | Clinic Owner (`insurance.write`) | Same four values prefilled in `#elig` / `#preauth` / `#cov` / `#copay` |
| Chip | — | **INSURANCE CLEARED** unchanged (true) |

Note: seeded DOCTOR role has `insurance:none`, so the editable correction form is not shown for doctors. Owner used for the form path (same RBAC as production admins with `insurance.write`).

## Artifacts

- `01-reception-entry-filled.png` / `01-reception-entry.png` — FO values before/after save
- `02-spine-prefilled-form.png` — full spine (chip + running total est. coverage/copay)
- `03-spine-insurance-fields.png` — Gates card with prefilled correction fields
- `report.json` / `form-values.json` — machine-readable values

## Unit / build

- `pnpm build` exit 0
- `pnpm test` 219/219 (includes `spine-insurance-draft-prefill.test.ts`)
