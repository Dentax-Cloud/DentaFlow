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

  it("nurse has clinical chart read-only, not write", () => {
    expect(normalizeDashboardRole(UserRole.NURSE)).toBe("NURSE");
    expect(can(UserRole.NURSE, "read", "clinical_chart")).toBe(true);
    expect(can(UserRole.NURSE, "write", "clinical_chart")).toBe(false);
    expect(hasPermission(UserRole.NURSE, PERMISSIONS.clinical_chart.read)).toBe(true);
    expect(hasPermission(UserRole.NURSE, PERMISSIONS.clinical_chart.write)).toBe(false);
    expect(can(UserRole.NURSE, "read", "clinical_schedule")).toBe(true);
    expect(can(UserRole.NURSE, "write", "patients")).toBe(true);
  });

  it("hygienist retains clinical chart write access", () => {
    expect(can(UserRole.HYGIENIST, "write", "clinical_chart")).toBe(true);
    expect(can(UserRole.HYGIENIST, "read", "clinical_chart")).toBe(true);
  });

  it("admin and owner retain clinical chart write access", () => {
    expect(can(UserRole.ADMIN, "write", "clinical_chart")).toBe(true);
    expect(can(UserRole.OWNER, "write", "clinical_chart")).toBe(true);
  });

  it("doctor can write clinical chart and patients but not appointments", () => {
    expect(can(UserRole.DOCTOR, "write", "clinical_chart")).toBe(true);
    expect(can(UserRole.DOCTOR, "write", "patients")).toBe(true);
    expect(can(UserRole.DOCTOR, "write", "appointments")).toBe(false);
    expect(can(UserRole.DENTIST, "write", "appointments")).toBe(false);
  });

  it("receptionist has clinical schedule read but not clinical chart", () => {
    expect(can(UserRole.RECEPTIONIST, "read", "clinical_schedule")).toBe(true);
    expect(can(UserRole.RECEPTIONIST, "read", "clinical_chart")).toBe(false);
    expect(can(UserRole.RECEPTIONIST, "write", "clinical_chart")).toBe(false);
  });

  it("receptionist has insurance.write but doctor does not (uses clinical_chart.write instead)", () => {
    expect(hasPermission(UserRole.RECEPTIONIST, PERMISSIONS.insurance.write)).toBe(true);
    expect(can(UserRole.RECEPTIONIST, "write", "insurance")).toBe(true);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.insurance.write)).toBe(false);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.clinical_chart.write)).toBe(true);
    expect(hasPermission(UserRole.NURSE, PERMISSIONS.insurance.write)).toBe(false);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.insurance.write)).toBe(true);
  });

  it("finance has billing full access and reports export", () => {
    expect(can(UserRole.FINANCE, "write", "billing")).toBe(true);
    expect(can(UserRole.FINANCE, "refund", "billing")).toBe(true);
    expect(can(UserRole.FINANCE, "export", "reports")).toBe(true);
    expect(can(UserRole.ACCOUNTANT, "refund", "billing")).toBe(true);
    expect(can(UserRole.FINANCE, "read", "clinical_chart")).toBe(false);
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
    expect(getRoleHomePath(UserRole.NURSE)).toBe("/clinical");
    expect(getRoleHomePath(UserRole.RECEPTIONIST)).toBe("/appointments");
    expect(getRoleHomePath(UserRole.FINANCE)).toBe("/billing");
    expect(getRoleHomePath(UserRole.STORE)).toBe("/inventory");
  });

  it("blocks doctor from admin routes", () => {
    expect(canAccessPath(UserRole.DOCTOR, "/admin")).toBe(false);
    expect(canAccessPath(UserRole.DOCTOR, "/clinical")).toBe(true);
  });

  it("allows nurse clinical chart read routes including chair setup", () => {
    expect(canAccessPath(UserRole.NURSE, "/clinical")).toBe(true);
    expect(canAccessPath(UserRole.NURSE, "/clinical/chair-setup")).toBe(true);
    expect(canAccessPath(UserRole.NURSE, "/clinical/radiographs")).toBe(true);
    expect(canAccessPath(UserRole.NURSE, "/clinical/encounter/appt-1")).toBe(true);
    expect(canAccessPath(UserRole.NURSE, "/clinical/chairside")).toBe(true);
  });

  it("blocks receptionist from clinical chart routes but allows treatment plans", () => {
    expect(canAccessPath(UserRole.RECEPTIONIST, "/clinical/radiographs")).toBe(false);
    expect(canAccessPath(UserRole.RECEPTIONIST, "/clinical/treatment-plans")).toBe(true);
    expect(canAccessPath(UserRole.RECEPTIONIST, "/clinical")).toBe(false);
  });

  it("filters sidebar items by role", () => {
    const doctorNav = getNavItemsForRole(UserRole.DOCTOR);
    expect(doctorNav.some((item) => item.href === "/clinical")).toBe(true);
    expect(doctorNav.some((item) => item.href === "/clinical/treatment-plans")).toBe(true);
    expect(doctorNav.some((item) => item.href === "/clinical/chairside")).toBe(false);
    expect(doctorNav.some((item) => item.href === "/admin")).toBe(false);

    const receptionNav = getNavItemsForRole(UserRole.RECEPTIONIST);
    expect(receptionNav.some((item) => item.href === "/clinical/treatment-plans")).toBe(true);
    expect(receptionNav.some((item) => item.href === "/clinical/radiographs")).toBe(false);
    expect(receptionNav.some((item) => item.href === "/clinical")).toBe(false);

    const financeNav = getNavItemsForRole(UserRole.FINANCE);
    expect(financeNav.some((item) => item.href === "/billing")).toBe(true);
    expect(financeNav.some((item) => item.href === "/clinical/chairside")).toBe(false);
    expect(financeNav.some((item) => item.href === "/admin")).toBe(false);

    const nurseNav = getNavItemsForRole(UserRole.NURSE);
    expect(nurseNav.some((item) => item.href === "/clinical")).toBe(true);
    expect(nurseNav.some((item) => item.href === "/clinical/chair-setup")).toBe(true);
    expect(nurseNav.some((item) => item.href === "/clinical/radiographs")).toBe(false);
  });
});
