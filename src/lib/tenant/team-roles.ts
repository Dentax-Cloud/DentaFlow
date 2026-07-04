import { UserRole } from "@prisma/client";

/** Roles that admins can assign when inviting or updating team members (canonical values). */
export const INVITABLE_ROLES = [
  UserRole.ADMIN,
  UserRole.DOCTOR,
  UserRole.HYGIENIST,
  UserRole.NURSE,
  UserRole.RECEPTIONIST,
  UserRole.FINANCE,
  UserRole.STORE,
] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** Map legacy stored roles to canonical invitable values for UI display and saves. */
export function normalizeToInvitableRole(role: UserRole): InvitableRole | null {
  if (role === UserRole.DENTIST) return UserRole.DOCTOR;
  if (role === UserRole.ACCOUNTANT) return UserRole.FINANCE;
  if (isInvitableRole(role)) return role;
  return null;
}

export function canEditInvitableStaffRole(role: UserRole): boolean {
  if (role === UserRole.OWNER || role === UserRole.ADMIN) return false;
  return normalizeToInvitableRole(role) !== null;
}

const DENTAFLOW_ROLE_METADATA_KEY = "dentaflowRole";

export function dentaflowRoleMetadata(role: UserRole) {
  return { [DENTAFLOW_ROLE_METADATA_KEY]: role };
}

export function readDentaflowRoleFromMetadata(metadata: unknown): UserRole | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[DENTAFLOW_ROLE_METADATA_KEY];
  if (typeof value !== "string") return null;
  if ((Object.values(UserRole) as string[]).includes(value)) {
    return value as UserRole;
  }
  return null;
}

export function isInvitableRole(role: UserRole): role is InvitableRole {
  return (INVITABLE_ROLES as readonly UserRole[]).includes(role);
}

export function resolveProvisionedUserRole(params: {
  membershipMetadata?: unknown;
  pendingInviteRole?: UserRole | null;
}): UserRole {
  if (params.pendingInviteRole) {
    const role = normalizeToInvitableRole(params.pendingInviteRole);
    if (role) return role;
  }

  const metadataRole = readDentaflowRoleFromMetadata(params.membershipMetadata);
  if (metadataRole) {
    const role = normalizeToInvitableRole(metadataRole);
    if (role) return role;
  }

  return UserRole.RECEPTIONIST;
}
