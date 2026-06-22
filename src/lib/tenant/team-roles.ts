import { UserRole } from "@prisma/client";

/** Roles that admins can assign when inviting or updating team members. */
export const INVITABLE_ROLES = [
  UserRole.ADMIN,
  UserRole.DENTIST,
  UserRole.HYGIENIST,
  UserRole.RECEPTIONIST,
  UserRole.ACCOUNTANT,
  UserRole.MANAGER,
] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

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
  if (params.pendingInviteRole && isInvitableRole(params.pendingInviteRole)) {
    return params.pendingInviteRole;
  }

  const metadataRole = readDentaflowRoleFromMetadata(params.membershipMetadata);
  if (metadataRole && isInvitableRole(metadataRole)) {
    return metadataRole;
  }

  return UserRole.RECEPTIONIST;
}
