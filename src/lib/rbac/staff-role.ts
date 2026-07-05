import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import type { TenantContext } from "@/lib/tenant/context";

/** Dashboard route shown when auth + tenant exist but StaffMember is missing. */
export const ACCOUNT_SETUP_INCOMPLETE_PATH = "/account-setup-incomplete";
/**
 * RBAC authoritative role source: StaffMember.role for the active tenant.
 * tenant_memberships.role is kept in sync for legacy/display only — never use it
 * for permission decisions (see auth session JWT and requireStaffMemberRole).
 */
export function requireStaffMemberRole(ctx: TenantContext): UserRole {
  if (!ctx.staffMember) {
    throw new Error("ACCOUNT_SETUP_INCOMPLETE");
  }
  return ctx.staffMember.role;
}

/** Fail-closed redirect for server pages/layouts when provisioning is incomplete. */
export function redirectIfStaffMemberMissing(ctx: TenantContext): void {
  if (!ctx.staffMember) {
    redirect(ACCOUNT_SETUP_INCOMPLETE_PATH);
  }
}
