# Step 0 — Duplicate leave-row note (resolved)

## What was duplicated

Not two rows for the **same** `employeeId`. Each click-test re-run inserted a **new** `Employee` (`HR Clicktest`) plus a new `LeaveRequest` with identical dates/reason, without deleting prior runs. Disposable DB after those runs:

| id | employeeId | dates | reason | status |
|----|------------|-------|--------|--------|
| `82abc2f1-…` | `f7906431-…` | 2026-09-10→11 | clicktest leave | approved |
| `8335f44c-…` | `4676e3fc-…` | 2026-09-10→11 | clicktest leave | approved |
| `7e812649-…` | `e77b5e0c-…` | 2026-09-10→11 | clicktest leave | approved |
| `b68c0385-…` (tracked) | `86278cbc-…` | 2026-09-10→11 | clicktest leave | approved |

`GROUP BY employeeId, leaveTypeId, startDate, endDate, reason HAVING COUNT(*) > 1` → **0 rows**.

Four employees named `HR Clicktest` matched four seed runs. Screenshot `03-leave-queue.png` showed “2 pending requests” with identical labels — two of those leftover cards.

## Root cause

**Seed-script artifact only.** `tmp-hr-phase1-clicktest.mjs` unlinked the doctor’s `staffMemberId` then inserted another employee/leave every run. Playwright clicked `.first()` card matching text `clicktest leave`, which was an **older** leave’s Approve button (`decideLeaveRequest({ id: thatCard.id })`). The assertion checked the **newest** `leaveId`, still `pending`, then applied a SQL fallback — producing the misleading note.

## Approve action — real gap?

**No.** `decideLeaveRequest` loads by exact `id` + `tenantId` (`tenantWhere(ctx.tenantId, { id: input.id })`). The leave-queue UI passes `r.id` from the row. It cannot match/approve “the wrong row” by date range.

**Related product gap (non-blocking fast-follow):** there is no uniqueness/overlap guard preventing an employee from submitting two identical pending leave ranges. That did **not** cause this note (duplicates were across different employees from re-seeding). Track as a Phase 1.1 polish item; **do not hold the PR**.

## Fix

Seed now deletes prior clicktest leave/time/docs/employees (`lastName='Clicktest'`, reason `clicktest%`) before insert. Click-test asserts exactly one pending `clicktest leave` card and requires UI approve of the tracked `leaveId` with **no SQL fallback**.
