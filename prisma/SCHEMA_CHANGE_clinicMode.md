# Add clinicMode to Tenant

In `prisma/schema.prisma`, inside `model Tenant`, add this field (recommended after `status`):

```prisma
clinicMode           String                  @default("group") // "solo" | "practice" | "group"
```

Then run:

```bash
pnpm prisma migrate dev --name add_clinic_mode
```

Or apply the SQL migration in `prisma/migrations/20261031100000_add_clinic_mode/`.

Existing tenants will default to `group`.
