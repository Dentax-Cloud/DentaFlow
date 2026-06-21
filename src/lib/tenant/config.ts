/**
 * Tenant platform configuration (env-driven).
 */
export const tenantConfig = {
  /** When true, new tenants start as PENDING until super-admin approves */
  approvalRequired: process.env.TENANT_APPROVAL_REQUIRED === "true",

  /** Comma-separated auth user IDs with platform super-admin access */
  superAdminAuthUserIds: (process.env.SUPER_ADMIN_AUTH_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),

  defaultLocale: "en",
  defaultTimezone: "UTC",
  minioBucketPrefix: process.env.MINIO_BUCKET ?? "dentaflow",
} as const;

export function isSuperAdmin(authUserId: string): boolean {
  return tenantConfig.superAdminAuthUserIds.includes(authUserId);
}

/** @deprecated Use superAdminAuthUserIds */
export const superAdminClerkUserIds = tenantConfig.superAdminAuthUserIds;
