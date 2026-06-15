/**
 * Tenant platform configuration (env-driven).
 */
export const tenantConfig = {
  /** When true, new tenants start as PENDING until super-admin approves */
  approvalRequired: process.env.TENANT_APPROVAL_REQUIRED === "true",

  /** Comma-separated Clerk user IDs with platform super-admin access */
  superAdminClerkUserIds: (process.env.SUPER_ADMIN_CLERK_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),

  defaultLocale: "en",
  defaultTimezone: "UTC",
  minioBucketPrefix: process.env.MINIO_BUCKET ?? "dentaflow",
} as const;

export function isSuperAdmin(clerkUserId: string): boolean {
  return tenantConfig.superAdminClerkUserIds.includes(clerkUserId);
}
