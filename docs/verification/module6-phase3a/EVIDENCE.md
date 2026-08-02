# Module 6 Phase 3a — live click-test evidence

- Branch tip: `4706672` (on `f3569e3` feature + chair-prep nav gated on spine flag)
- Stack: `dentaflow-phase3a-clicktest-web` on `127.0.0.1:3650` (SSH tunnel → VPS)
- DB: `dentaflow_phase3a_clicktest` (pg_dump prod → restore → apply only `20260929000000_module6_phase3a_exam_nurse_chairprep`)
- Seeded appt: `phase3a_clicktest_appt` (Harry Smith, Chair 1, BOM procedure, clinic day 2026-08-02)
- Accounts: `doctor.gb.kensington@…` / `owner.gb.kensington@…` / `nurse.gb.kensington@…` / `Test1234!`
- Prod `dentaflow-web-prod` remained healthy
- Machine summary: `summary.json` → `"ok": true`

## Docker hang root cause (local)

Local Docker Desktop CLI hung (`docker info` / `compose ps` 15s timeouts). Diagnostics:

1. **C: disk critically full (0.26 GB free)** at reproduce time — Docker Desktop data/VM lives on C:.
2. After freeing temp/cache (~18 GB free), **`com.docker.service` stayed Stopped**; `Start-Service` failed without elevation (`Cannot open com.docker.service`).
3. Orphan `com.docker.backend` processes still held project ports while the API stayed unresponsive.

**Resolution:** Declared local Docker unusable after a real fix attempt; used the standing **VPS project-scoped disposable stack** (PR #14 pattern). Local Postgres `:5435` was not listening.

## Flag OFF

Screenshot: `01-flag-off-legacy.png` · JSON: `flag-off.json`

| Check | Result |
|--------|--------|
| Spine route | Redirects away (`spineUnreachable: true`) |
| `/clinical/chair-prep` | Redirects to `/clinical` |
| Exam card | Absent (no Mark exam complete) |
| Chair prep nav | Absent (`chairPrepNavAbsent: true` after `4706672`) |
| Hydration warnings | **[]** (zero) |

## Flag ON — clinical E2E (owner)

Screenshots: `02-exam-card.png`, `03-flag-on-owner-billing.png` · JSON: `flag-on-owner.json`

Owner used because DOCTOR has `insurance:none` and cannot clear the insurance gate (role matrix).

Flow: encounter → Mark exam complete → clear risk/consent/insurance → sterilize → start → complete procedure → close out → **Close & invoice**.

| Check | Result |
|--------|--------|
| `examCompletedAt` | `2026-08-02T10:33:10.836Z` |
| `examinedByStaffId` | set |
| Invoice | **INV-000025** total `168` |
| Encounter closed | `recall_scheduled` / `closedAt` set |
| Hydration warnings | **[]** (zero) |

## Flag ON — nurse

Screenshots: `04-nurse-spine-workspace.png`, `05-chair-prep-checklist.png` · JSON: `flag-on-nurse.json`

| Check | Result |
|--------|--------|
| Gate clear controls | Absent (`Clear risk` / `Grant clinical consent` / override) |
| Chair prep route | Reachable |
| Aggregated BOM | Amoxicillin 500mg · Articaine 4% + Epinephrine (2 lines) |
| Prepared checkbox | Marked (`chairMarkedPrepared: true`) |
| Hydration warnings | **[]** (zero) |

## Screenshots required by prompt

1. Chief Complaint / Exam card → `02-exam-card.png`
2. Nurse-scoped workspace → `04-nurse-spine-workspace.png`
3. Chair-prep checklist with BOM → `05-chair-prep-checklist.png`
