# DentaFlow — AI Agent Context & House Rules

Read this fully before touching any code. These rules exist because
violating them has caused real production bugs in this project.

## Non-negotiable rules

1. **ID generation**: Always use existing generators in `src/lib/ids/generate-ids.ts`
   ({ENTITY}-{tenantCode}-{...}-{seq} pattern). Never invent a new ID scheme.

2. **Fail closed, never fail open**: Any permission/role resolution that
   cannot determine access must DENY, never default to a permissive role
   (e.g. never `ctx.staffMember?.role ?? UserRole.OWNER`). This caused a
   real security bypass previously — do not reintroduce this pattern.

3. **Decimal serialization**: Prisma `Decimal` fields must go through
   `serializeDecimal()` (src/lib/serialize or equivalent) before being
   passed to any client component. Raw Decimals crash Next.js RSC boundaries.

4. **Timezone handling**: All clinic-facing date/time logic must use
   `src/lib/datetime/clinic-timezone.ts` (clinicLocalToUtc, formatClinicTime,
   getClinicDayBounds) and `Tenant.timezone`. Never construct dates with
   raw `new Date(y, m, d, h, min)` or `new Date(\`${date}T${time}\`)` —
   this caused a confirmed 4-hour production bug.

5. **Migrations, always**: Schema changes go through
   `npx prisma migrate dev --name X`, generating a real migration file
   committed to git. Never use `db push` against shared/production
   databases. Every schema change must have a matching migration file.

6. **No "silent acceptance of incomplete data"**: Any save/complete/submit
   action must validate meaningfully — do not allow an action to succeed
   with null/empty/zero core fields with no warning. This pattern has
   caused real bugs three times in this project (chairside finalize,
   booking, insurance submission).

7. **RBAC resource pattern**: Use `requirePermission()` / `requireRouteAccess()`
   with existing resource names (clinical_schedule, clinical_chart, admin,
   billing, etc. — see src/lib/rbac/permissions.ts). Do not invent a
   parallel permission check.

## Module boundaries for new feature work

New modules (telehealth, WhatsApp, prescriptions, lab integration, etc.)
should be ADDITIVE:
- New Prisma models referencing existing Patient.id / Appointment.id /
  tenantId via foreign key — do not modify existing models
- New files under a new feature directory
  (src/app/(dashboard)/features/{module-name}/)
- New sidebar nav entries following the existing pattern in
  src/lib/rbac/navigation.ts

FORBIDDEN without explicit sign-off:
- Editing schema.prisma models that already exist (only ADD new models)
- Editing src/lib/rbac/*, auth.ts, the appointment/chairside/billing/
  insurance completion pipeline (chairside-lifecycle.ts, complete-visit.ts,
  claim-actions.ts, insurance-calculator.ts)
- Running migrate dev/db push against anything but an isolated dev database

## Workflow

1. Work in a dedicated feature branch, never on `main`
2. Audit before building — confirm what exists before assuming a gap
3. Report what you built clearly (files changed, what each does, how
   to verify) before requesting merge
4. All merges to `main` require: build passes, tests pass, and a manual
   verification pass on the actual running app — "build succeeded" alone
   is never sufficient proof a feature works correctly in this project
EOF
