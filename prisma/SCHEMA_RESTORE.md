# Schema Restore Instructions

The full `prisma/schema.prisma` is too large for a single API push in this session.

## On the VPS (recommended)

The schema was already restored and is working in production. To sync it back:

```bash
cd /opt/DentaFlow
git checkout feat/solo-phase1-foundation
# Copy the working schema from the running container or local fix
docker compose -f docker-compose.prod.yml exec web cat prisma/schema.prisma > prisma/schema.prisma

# Ensure clinicType is present (add if missing):
# clinicType           String                  @default("practice") // "solo" | "practice" | "group"

git add prisma/schema.prisma
git commit -m "fix: restore schema with clinicType"
git push origin feat/solo-phase1-foundation
```

## From a known-good commit

```bash
git checkout d6d85c2809da1a15327120e170e842cb8ae97271 -- prisma/schema.prisma
sed -i '/status               TenantStatus/a\  clinicType           String                  @default("practice") // "solo" | "practice" | "group"' prisma/schema.prisma
```

The migration SQL in `prisma/migrations/20261101000000_add_clinic_type/` is ready once the schema is restored.
