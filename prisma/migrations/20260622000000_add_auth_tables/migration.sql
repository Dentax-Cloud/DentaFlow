CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT NOT NULL,
  name TEXT,
  email TEXT NOT NULL,
  "emailVerified" TIMESTAMP(3),
  image TEXT,
  "passwordHash" TEXT,
  "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
  "activeTenantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT auth_users_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_key ON auth_users(email);
CREATE TABLE IF NOT EXISTS tenant_memberships (
  id TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "invitedEmail" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tenant_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT tm_user_fk FOREIGN KEY ("userId") REFERENCES auth_users(id) ON DELETE CASCADE,
  CONSTRAINT tm_tenant_fk FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS tm_user_tenant_key ON tenant_memberships("userId", "tenantId");
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authUserId" TEXT;
