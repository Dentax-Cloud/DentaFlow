# Solo Mode Schema Change

Add the following field to the `Tenant` model in `prisma/schema.prisma`:

```prisma
clinicMode String @default("group") // "solo" | "practice" | "group"
```

Then run:

```bash
pnpm prisma migrate dev --name add_clinic_mode
```

Existing clinics will default to `group` and keep current behavior.
Solo clinics will use the simplified navigation and combined permissions.
