# Critical Tenant IDOR — verify + fix evidence

Branch: `fix/critical-tenant-idor-isolation`

## Step 0 — Disposable reproduction (pre-fix)

Stack: `dentaflow-idor-clicktest-web` on `127.0.0.1:3680`, DB `dentaflow_idor_clicktest` (migrate deploy from empty + `pnpm db:seed` + Tenant B fixtures).

Session: `owner@brightsmile.demo` / `BrightSmile@123` → `activeTenantId=tenant_a`.

| Claim | Result |
|-------|--------|
| 1 `getPatients(["tenant_b"])` via Next-Action | **REPRODUCED** — returned `patient_b_1` CrossTenant Victim |
| 1 `getInvoices(["tenant_b"])` | **REPRODUCED** — returned `invoice_b_1` INV-B-001 |
| 1 `getSubscriptionOverview(["tenant_b"])` | **REPRODUCED** — `{patients:1,invoices:1,...}` for B |
| 2 `createProcedureLine` + `closeProcedureLine` with `titem_b_completed` | **REPRODUCED** — response contained `SECRET_PLAN_TITLE_TENANT_B` when plan fully complete |
| 3 `generateInvoiceFromProcedures` with catalog consumption → `inv_b_1` | **REPRODUCED** — Tenant B qty 50 → 47 |
| 4 `/reception` fail-open | **Moderate (not Critical)** — page has `requireRouteAccess(appointments,read)`; client `canAccessPath` omitted rule. Fixed by adding ROUTE_RULE. |

## Fix summary

- Session-derived tenant for all previously client-trusted `"use server"` getters/mutations.
- `treatmentItemId` / inventory consumption IDs ownership-checked against session tenant.
- `/reception` added to `ROUTE_RULES`.
- Super-admin audit/Stripe reads moved off shared `"use server"` exports onto RSC/`lib` helpers.

## Automated

- `pnpm test` — 38 files / **246** tests (includes `tenant-idor-isolation.test.ts`)
- `pnpm build` — exit 0
