import { UserRole } from "@prisma/client";

/** Fine-grained permission keys used by server actions and guards. */
export const PERMISSIONS = {
  patients: {
    read: "patients:read",
    write: "patients:write",
    delete: "patients:delete",
  },
  appointments: {
    read: "appointments:read",
    write: "appointments:write",
    delete: "appointments:delete",
  },
  /** Read-only: treatment plan summaries, appointment clinical status. */
  clinical_schedule: {
    read: "clinical_schedule:read",
  },
  /** Odontogram, perio, imaging, chairside, SOAP notes, clinical writes. */
  clinical_chart: {
    read: "clinical_chart:read",
    write: "clinical_chart:write",
  },
  billing: {
    read: "billing:read",
    write: "billing:write",
    refund: "billing:refund",
  },
  inventory: {
    read: "inventory:read",
    write: "inventory:write",
  },
  crm: {
    read: "crm:read",
    write: "crm:write",
  },
  reports: {
    read: "reports:read",
    export: "reports:export",
  },
  admin: {
    read: "admin:read",
    write: "admin:write",
    users: "admin:users",
    audit: "admin:audit",
  },
  ai: {
    use: "ai:use",
  },
} as const;

export type PermissionKey = {
  [K in keyof typeof PERMISSIONS]: (typeof PERMISSIONS)[K][keyof (typeof PERMISSIONS)[K]];
}[keyof typeof PERMISSIONS];

/** Resources aligned with the product permission matrix. */
export const RESOURCES = {
  patients: "patients",
  appointments: "appointments",
  clinical_schedule: "clinical_schedule",
  clinical_chart: "clinical_chart",
  billing: "billing",
  inventory: "inventory",
  reports: "reports",
  team: "team",
  admin: "admin",
  crm: "crm",
  ai: "ai",
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

export type Action = "read" | "write" | "delete" | "export" | "refund" | "use";

export type AccessLevel = "none" | "read" | "limited" | "write" | "full";

/** Primary dashboard roles shown in the product matrix. */
export type DashboardRole =
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "FINANCE"
  | "STORE";

/**
 * Maps stored UserRole values (including legacy aliases) to dashboard roles.
 */
export function normalizeDashboardRole(role: UserRole): DashboardRole {
  switch (role) {
    case UserRole.ADMIN:
    case UserRole.OWNER:
    case UserRole.MANAGER:
      return "ADMIN";
    case UserRole.DOCTOR:
    case UserRole.DENTIST:
    case UserRole.HYGIENIST:
      return "DOCTOR";
    case UserRole.NURSE:
      return "NURSE";
    case UserRole.RECEPTIONIST:
      return "RECEPTIONIST";
    case UserRole.FINANCE:
    case UserRole.ACCOUNTANT:
      return "FINANCE";
    case UserRole.STORE:
      return "STORE";
    default:
      return "RECEPTIONIST";
  }
}

/**
 * Permission matrix — source of truth for role access.
 *
 * clinical_schedule: plan/status summaries (reception read-only)
 * clinical_chart: odontogram, perio, imaging, chairside (clinical staff)
 */
export const PERMISSION_MATRIX: Record<DashboardRole, Record<Resource, AccessLevel>> = {
  ADMIN: {
    patients: "full",
    appointments: "full",
    clinical_schedule: "full",
    clinical_chart: "full",
    billing: "full",
    inventory: "full",
    reports: "full",
    team: "full",
    admin: "full",
    crm: "full",
    ai: "full",
  },
  DOCTOR: {
    patients: "write",
    appointments: "read",
    clinical_schedule: "read",
    clinical_chart: "full",
    billing: "read",
    inventory: "read",
    reports: "limited",
    team: "none",
    admin: "none",
    crm: "none",
    ai: "full",
  },
  NURSE: {
    patients: "write",
    appointments: "read",
    clinical_schedule: "read",
    clinical_chart: "read",
    billing: "read",
    inventory: "read",
    reports: "limited",
    team: "none",
    admin: "none",
    crm: "none",
    ai: "full",
  },
  RECEPTIONIST: {
    patients: "write",
    appointments: "full",
    clinical_schedule: "read",
    clinical_chart: "none",
    billing: "read",
    inventory: "read",
    reports: "limited",
    team: "none",
    admin: "none",
    crm: "full",
    ai: "none",
  },
  FINANCE: {
    patients: "read",
    appointments: "read",
    clinical_schedule: "none",
    clinical_chart: "none",
    billing: "full",
    inventory: "read",
    reports: "full",
    team: "none",
    admin: "none",
    crm: "read",
    ai: "none",
  },
  STORE: {
    patients: "read",
    appointments: "read",
    clinical_schedule: "none",
    clinical_chart: "none",
    billing: "read",
    inventory: "full",
    reports: "limited",
    team: "none",
    admin: "none",
    crm: "none",
    ai: "none",
  },
};

function accessAllows(level: AccessLevel, action: Action): boolean {
  if (level === "none") return false;
  if (level === "full") return true;

  switch (action) {
    case "read":
      return level === "read" || level === "write" || level === "limited";
    case "write":
      return level === "write";
    case "delete":
    case "export":
    case "refund":
    case "use":
      return false;
    default:
      return false;
  }
}

/** Legacy role tweaks layered on top of the normalized matrix. */
function applyLegacyRoleOverrides(
  role: UserRole,
  resource: Resource,
  action: Action,
  allowed: boolean,
): boolean {
  if (!allowed) return false;

  if (role === UserRole.MANAGER) {
    if (resource === "team") return false;
    if (resource === "admin" && action !== "read") return false;
  }

  if (role === UserRole.HYGIENIST) {
    if (resource === "billing") return false;
    if (resource === "reports") return action === "read";
  }

  return true;
}

/**
 * Checks whether a role may perform an action on a resource.
 */
export function can(role: UserRole, action: Action, resource: Resource): boolean {
  if (role === UserRole.OWNER) return true;

  const dashboardRole = normalizeDashboardRole(role);
  const level = PERMISSION_MATRIX[dashboardRole][resource];
  const allowed = accessAllows(level, action);
  return applyLegacyRoleOverrides(role, resource, action, allowed);
}

function permissionKeyToCheck(permission: PermissionKey): { resource: Resource; action: Action } | null {
  switch (permission) {
    case PERMISSIONS.patients.read:
      return { resource: "patients", action: "read" };
    case PERMISSIONS.patients.write:
      return { resource: "patients", action: "write" };
    case PERMISSIONS.patients.delete:
      return { resource: "patients", action: "delete" };
    case PERMISSIONS.appointments.read:
      return { resource: "appointments", action: "read" };
    case PERMISSIONS.appointments.write:
      return { resource: "appointments", action: "write" };
    case PERMISSIONS.appointments.delete:
      return { resource: "appointments", action: "delete" };
    case PERMISSIONS.clinical_schedule.read:
      return { resource: "clinical_schedule", action: "read" };
    case PERMISSIONS.clinical_chart.read:
      return { resource: "clinical_chart", action: "read" };
    case PERMISSIONS.clinical_chart.write:
      return { resource: "clinical_chart", action: "write" };
    case PERMISSIONS.billing.read:
      return { resource: "billing", action: "read" };
    case PERMISSIONS.billing.write:
      return { resource: "billing", action: "write" };
    case PERMISSIONS.billing.refund:
      return { resource: "billing", action: "refund" };
    case PERMISSIONS.inventory.read:
      return { resource: "inventory", action: "read" };
    case PERMISSIONS.inventory.write:
      return { resource: "inventory", action: "write" };
    case PERMISSIONS.crm.read:
      return { resource: "crm", action: "read" };
    case PERMISSIONS.crm.write:
      return { resource: "crm", action: "write" };
    case PERMISSIONS.reports.read:
      return { resource: "reports", action: "read" };
    case PERMISSIONS.reports.export:
      return { resource: "reports", action: "export" };
    case PERMISSIONS.admin.read:
      return { resource: "admin", action: "read" };
    case PERMISSIONS.admin.write:
      return { resource: "admin", action: "write" };
    case PERMISSIONS.admin.users:
      return { resource: "team", action: "write" };
    case PERMISSIONS.admin.audit:
      return { resource: "admin", action: "read" };
    case PERMISSIONS.ai.use:
      return { resource: "ai", action: "use" };
    default:
      return null;
  }
}

export function hasPermission(role: UserRole, permission: PermissionKey): boolean {
  const check = permissionKeyToCheck(permission);
  if (!check) return false;
  return can(role, check.action, check.resource);
}

export function getRolePermissions(role: UserRole): PermissionKey[] {
  const all = Object.values(PERMISSIONS).flatMap((group) => Object.values(group)) as PermissionKey[];
  return all.filter((permission) => hasPermission(role, permission));
}

const CLINICAL_ROLES: UserRole[] = [
  UserRole.DOCTOR,
  UserRole.DENTIST,
  UserRole.HYGIENIST,
];

export function isClinicalRole(role: UserRole | string): boolean {
  return CLINICAL_ROLES.includes(role as UserRole);
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.OWNER:
      return "Clinic Owner";
    case UserRole.ADMIN:
      return "Admin";
    case UserRole.DOCTOR:
    case UserRole.DENTIST:
      return "Doctor";
    case UserRole.HYGIENIST:
      return "Hygienist";
    case UserRole.NURSE:
      return "Nurse / Assistant";
    case UserRole.RECEPTIONIST:
      return "Receptionist";
    case UserRole.FINANCE:
    case UserRole.ACCOUNTANT:
      return "Finance";
    case UserRole.STORE:
      return "Store / Inventory";
    case UserRole.MANAGER:
      return "Manager";
    case UserRole.STAFF:
      return "Staff";
    default:
      return role;
  }
}
