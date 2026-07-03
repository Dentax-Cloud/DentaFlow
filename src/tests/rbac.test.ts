import { describe, it, expect } from "vitest";
import { can, hasPermission, PERMISSIONS, normalizeDashboardRole } from "@/lib/rbac/permissions";
import { canAccessPath, getRoleHomePath } from "@/lib/rbac/routes";
import { getNavItemsForRole } from "@/lib/rbac/navigation";
import { UserRole } from "@prisma/client";

describe("RBAC permission matrix", () => {
  it("admin has full patient access", () => {
    expect(can(UserRole.ADMIN, "delete", "patients")).toBe(true);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.patients.delete)).toBe(true);
  });

  it("owner maps to admin dashboard role", () => {
    expect(normalizeDashboardRole(UserRole.OWNER)).toBe("ADMIN");
    expect(hasPermission(UserRole.OWNER, PERMISSIONS.admin.write)).toBe(true);
  });

  it("receptionist can write patients but not delete", () => {
    expect(can(UserRole.RECEPTIONIST, "write", "patients")).toBe(true);
    expect(can(UserRole.RECEPTIONIST, "delete", "patients")).toBe(false);
  });

  it("doctor can write clinical and patients but not appointments", () => {
    expect(can(UserRole.DOCTOR, "write", "clinical")).toBe(true);
    expect(can(UserRole.DOCTOR, "write", "patients")).toBe(true);
    expect(can(UserRole.DOCTOR, "write", "appointments")).toBe(false);
    expect(can(UserRole.DENTIST, "write", "appointments")).toBe(false);
  });

  it("finance has billing full access and reports export", () => {
    expect(can(UserRole.FINANCE, "write", "billing")).toBe(true);
    expect(can(UserRole.FINANCE, "refund", "billing")).toBe(true);
    expect(can(UserRole.FINANCE, "export", "reports")).toBe(true);
    expect(can(UserRole.ACCOUNTANT, "refund", "billing")).toBe(true);
  });

  it("store has inventory full access only", () => {
    expect(can(UserRole.STORE, "write", "inventory")).toBe(true);
    expect(can(UserRole.STORE, "write", "billing")).toBe(false);
    expect(can(UserRole.STORE, "write", "patients")).toBe(false);
  });

  it("non-admin roles cannot access team or admin settings", () => {
    for (const role of [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.FINANCE, UserRole.STORE]) {
      expect(can(role, "write", "team")).toBe(false);
      expect(can(role, "write", "admin")).toBe(false);
    }
  });
});

describe("RBAC routes and navigation", () => {
  it("returns role-specific home paths", () => {
    expect(getRoleHomePath(UserRole.ADMIN)).toBe("/dashboard");
    expect(getRoleHomePath(UserRole.DOCTOR)).toBe("/clinical");
    expect(getRoleHomePath(UserRole.RECEPTIONIST)).toBe("/appointments");
    expect(getRoleHomePath(UserRole.FINANCE)).toBe("/billing");
    expect(getRoleHomePath(UserRole.STORE)).toBe("/inventory");
  });

  it("blocks doctor from admin routes", () => {
    expect(canAccessPath(UserRole.DOCTOR, "/admin")).toBe(false);
    expect(canAccessPath(UserRole.DOCTOR, "/clinical")).toBe(true);
  });

  it("filters sidebar items by role", () => {
    const doctorNav = getNavItemsForRole(UserRole.DOCTOR);
    expect(doctorNav.some((item) => item.href === "/clinical")).toBe(true);
    expect(doctorNav.some((item) => item.href === "/clinical/treatment-plans")).toBe(true);
    expect(doctorNav.some((item) => item.href === "/clinical/chairside")).toBe(false);
    expect(doctorNav.some((item) => item.href === "/admin")).toBe(false);

    const financeNav = getNavItemsForRole(UserRole.FINANCE);
    expect(financeNav.some((item) => item.href === "/billing")).toBe(true);
    expect(financeNav.some((item) => item.href === "/clinical/chairside")).toBe(false);
    expect(financeNav.some((item) => item.href === "/admin")).toBe(false);
  });
});
