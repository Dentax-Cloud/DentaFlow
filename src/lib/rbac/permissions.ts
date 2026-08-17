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
  /** Nurse chairside assistance, distinct from clinical charting and gates. */
  clinical_assist: {
    write: "clinical_assist:write",
  },
  /** Front-office encounter insurance verification (Module 6). */
  insurance: {
    write: "insurance:write",
  },
  /**
   * Store-facing chair tray/stock visibility (ChairDaySetup JSON).
   * Distinct from clinical_chart — STORE must not get chart access.
   */
  chair_inventory: {
    read: "chair_inventory:read",
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
  /** HR directory / cross-employee writes (OWNER/ADMIN). Self-service is identity-scoped. */
  hr: {
    read: "hr:read",
    write: "hr:write",
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
  clinical_assist: "clinical_assist",
  insurance: "insurance",
  chair_inventory: "chair_inventory",
  billing: "billing",
  inventory: "inventory",
  hr: "hr",
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
 * insurance: front-office encounter insurance verification (receptionist write)
 * chair_inventory: Store (and Nurse) visibility of chair tray state — not clinical chart
 * hr: HR directory / approvals (OWNER/ADMIN); employee self-service is identity-scoped separately
 */
export const PERMISSION_MATRIX: Record<DashboardRole, Record<Resource, AccessLevel>> = {
  ADMIN: {
    patients: "full",
    appointments: "full",
    clinical_schedule: "full",
    clinical_chart: "full",
    clinical_assist: "full",
    insurance: "full",
    chair_inventory: "full",
    billing: "full",
    inventory: "full",
    hr: "full",
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
    clinical_assist: "write",
    insurance: "none",
    chair_inventory: "none",
    billing: "read",
    inventory: "read",
    hr: "none",
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
    clinical_assist: "write",
    insurance: "none",
    chair_inventory: "read",
    billing: "none",
    inventory: "read",
    hr: "none",
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
    clinical_assist: "none",
    insurance: "write",
    chair_inventory: "none",
    billing: "read",
    inventory: "none",
    hr: "none",
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
    clinical_assist: "none",
    insurance: "none",
    chair_inventory: "none",
    billing: "full",
    inventory: "read",
    hr: "none",
    reports: "full",
    team: "none",
    admin: "none",
    crm: "read",
    ai: "none",
  },
  STORE: {
    patients: "none",
    appointments: "none",
    clinical_schedule: "none",
    clinical_chart: "none",
    clinical_assist: "none",
    insurance: "none",
    chair_inventory: "read",
    // Store job is stock/POS — PHI-adjacent clinic browse is not granted.
    billing: "none",
    inventory: "full",
    hr: "none",
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
    case PERMISSIONS.clinical_assist.write:
      return { resource: "clinical_assist", action: "write" };
    case PERMISSIONS.insurance.write:
      return { resource: "insurance", action: "write" };
    case PERMISSIONS.chair_inventory.read:
      return { resource: "chair_inventory", action: "read" };
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
    case PERMISSIONS.hr.read:
      return { resource: "hr", action: "read" };
    case PERMISSIONS.hr.write:
      return { resource: "hr", action: "write" };
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
