import type { UserRole } from "@prisma/client";
import { can, normalizeDashboardRole, type Action, type Resource } from "./permissions";

export type RouteRule = {
  prefix: string;
  resource: Resource;
  action: Action;
};

/** Longest-prefix wins when resolving access. */
export const ROUTE_RULES: RouteRule[] = [
  { prefix: "/admin/data-import", resource: "admin", action: "write" },
  { prefix: "/admin/tenant-approvals", resource: "admin", action: "write" },
  { prefix: "/admin/clinic-profile", resource: "admin", action: "read" },
  { prefix: "/admin", resource: "admin", action: "read" },
  { prefix: "/billing/subscription", resource: "admin", action: "read" },
  { prefix: "/billing", resource: "billing", action: "read" },
  { prefix: "/inventory/chairs", resource: "chair_inventory", action: "read" },
  { prefix: "/inventory", resource: "inventory", action: "read" },
  { prefix: "/hr", resource: "hr", action: "read" },
  { prefix: "/appointments", resource: "appointments", action: "read" },
  { prefix: "/reception", resource: "appointments", action: "read" },
  { prefix: "/clinical/treatment-plans", resource: "clinical_schedule", action: "read" },
  { prefix: "/clinical/encounter", resource: "clinical_chart", action: "read" },
  { prefix: "/clinical/chairside", resource: "clinical_chart", action: "read" },
  { prefix: "/clinical", resource: "clinical_chart", action: "read" },
  { prefix: "/patients", resource: "patients", action: "read" },
  { prefix: "/reports", resource: "reports", action: "read" },
  { prefix: "/crm", resource: "crm", action: "read" },
  { prefix: "/ai", resource: "ai", action: "use" },
  { prefix: "/dashboard", resource: "reports", action: "read" },
  { prefix: "/super-admin", resource: "admin", action: "write" },
  // Identity-scoped staff profile (session member only). patients:read is held
  // by every current dashboard role; canAccessPath also special-cases /account.
  { prefix: "/account", resource: "patients", action: "read" },
  // Clinic setup checklist — admin destinations (catalog, team, profile).
  { prefix: "/onboarding", resource: "admin", action: "read" },
];

const ROLE_HOME: Record<ReturnType<typeof normalizeDashboardRole>, string> = {
  ADMIN: "/dashboard",
  DOCTOR: "/clinical",
  NURSE: "/clinical",
  RECEPTIONIST: "/appointments",
  FINANCE: "/billing",
  STORE: "/inventory",
};

export function getRoleHomePath(role: UserRole): string {
  return ROLE_HOME[normalizeDashboardRole(role)];
}

export function resolveRouteRule(pathname: string): RouteRule | null {
  const sorted = [...ROUTE_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  return sorted.find((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) ?? null;
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  // Identity-scoped self-service: any authenticated dashboard role may open
  // /hr/me; the page itself requires HR_MODULE_ENABLED + linked Employee.
  if (pathname === "/hr/me" || pathname.startsWith("/hr/me/")) return true;
  // Identity-scoped staff profile at /account (own session member only).
  if (pathname === "/account" || pathname.startsWith("/account/")) return true;
  const rule = resolveRouteRule(pathname);
  if (!rule) return true;
  return can(role, rule.action, rule.resource);
}
