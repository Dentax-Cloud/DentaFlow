-- Remove dead Clerk auth columns (migrated to NextAuth)

DROP INDEX IF EXISTS "Tenant_clerkOrgId_key";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "clerkOrgId";

DROP INDEX IF EXISTS "User_clerkUserId_idx";
DROP INDEX IF EXISTS "User_tenantId_clerkUserId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "clerkUserId";
