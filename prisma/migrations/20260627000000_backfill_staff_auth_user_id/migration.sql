-- Link StaffMember rows to auth_users by email where authUserId was never set
UPDATE "User" s
SET "authUserId" = a.id
FROM auth_users a
WHERE lower(trim(s.email)) = lower(trim(a.email))
  AND s."authUserId" IS NULL;

-- Clear stale clinic context for platform superadmins
UPDATE auth_users SET "activeTenantId" = NULL WHERE "isSuperAdmin" = true;
