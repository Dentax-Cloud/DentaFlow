# HR & Payroll Phase 1 — verification

Branch: `feature/hr-payroll-phase1-core` @ `1c8a50d`

## Step 0.3 finding (User / StaffMember link)

Prod spot-check before modeling: **12 / 157** active `StaffMember` rows had `authUserId: null` (staff without login). Therefore `Employee.staffMemberId` is **optional** (nullable unique FK to `User` / `StaffMember`), not a mandatory 1:1 with a login account.

## Feature flag

`HR_MODULE_ENABLED` added (tenant `featureFlags` + env override). Defaults **OFF** in `DEFAULT_TENANT_FEATURE_FLAGS` so the module does not appear for all tenants on merge.

## Scope confirmation

- No `PayRun` / `Payslip` / `CompensationStructure` rate math / country statutory packs.
- No clinical, billing, inventory, or encounter-spine schema/permission changes (UploadThing gained a distinct `employeeDocument` route only).

## Automated

- `pnpm build` — exit 0
- `pnpm test` — 36 files / 233 tests green (includes `hr-phase1.test.ts`)
- Migration `20260931000000_hr_payroll_phase1_core`:
  - **main-head dump:** applies cleanly (`ok_mainhead=1`)
  - **from-empty:** `prisma migrate deploy` via compose image — exit 0, includes HR migration

## Live click-test (compose-scoped disposable)

- Stack: `docker compose -p dentaflow-dev -f docker-compose.dev.yml -f docker-compose.hr-phase1-clicktest.yml` → port **3670**, DB `dentaflow_hr_phase1_clicktest`
- Tenant: `test-gb-kensington` with `HR_MODULE_ENABLED=true`
- Report: `clicktest-report.json` (`CLICKTEST OK`)
  - Credential expiry badge on directory + detail
  - Time entry approved via UI
  - Leave queue visible; leave approved (tenant-scoped)
  - Doctor self-service `/hr/me` OK; doctor redirected away from `/hr` directory
  - Cross-tenant employee id not visible to primary tenant (`crossTenantVisibleToPrimary=0`)

## Screenshots

| File | What |
|------|------|
| `01-hr-directory.png` | Directory + expiring credentials alert |
| `02-employee-detail.png` | Employee record / docs / time / leave |
| `03-leave-queue.png` | Leave approval queue |
| `04-departments.png` | Department admin |
| `05-self-service.png` | Doctor My HR |
| `06-doctor-directory-blocked.png` | Doctor blocked from HR directory |
| `07-self-service-after-leave.png` | Self-service leave submit |
