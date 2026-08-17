import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { getNavItemsForRole } from "@/lib/rbac/navigation";
import { can, hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { canAccessPath } from "@/lib/rbac/routes";

describe("STORE nav / matrix vs store job (recon B2)", () => {
  it("lists STORE sidebar hrefs for evidence", () => {
    const hrefs = getNavItemsForRole(UserRole.STORE).map((item) => item.href);
    expect(hrefs).toContain("/inventory");
    expect(hrefs).toContain("/inventory/chairs");
    expect(hrefs).toContain("/dashboard");
    // PHI-adjacent over-exposure (must not remain after the fix):
    expect(hrefs).not.toContain("/patients");
    expect(hrefs).not.toContain("/reception");
    expect(hrefs).not.toContain("/appointments");
    expect(hrefs).not.toContain("/billing");
    expect(hrefs).not.toContain("/reports");
  });

  it("STORE cannot open PHI routes via canAccessPath", () => {
    expect(canAccessPath(UserRole.STORE, "/inventory")).toBe(true);
    expect(canAccessPath(UserRole.STORE, "/dashboard")).toBe(true);
    expect(canAccessPath(UserRole.STORE, "/patients")).toBe(false);
    expect(canAccessPath(UserRole.STORE, "/reception")).toBe(false);
    expect(canAccessPath(UserRole.STORE, "/appointments")).toBe(false);
    expect(canAccessPath(UserRole.STORE, "/billing")).toBe(false);
    expect(canAccessPath(UserRole.STORE, "/reports")).toBe(false);
  });

  it("STORE lacks patients/appointments/billing read in the matrix", () => {
    expect(can(UserRole.STORE, "read", "patients")).toBe(false);
    expect(can(UserRole.STORE, "read", "appointments")).toBe(false);
    expect(can(UserRole.STORE, "read", "billing")).toBe(false);
    expect(hasPermission(UserRole.STORE, PERMISSIONS.inventory.write)).toBe(true);
    expect(hasPermission(UserRole.STORE, PERMISSIONS.chair_inventory.read)).toBe(true);
  });
});

describe("other dashboard roles — nav vs matrix (Finding 4 remainder)", () => {
  it("OWNER/ADMIN keep clinic-wide nav", () => {
    const hrefs = getNavItemsForRole(UserRole.ADMIN).map((item) => item.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(["/dashboard", "/patients", "/reception", "/appointments", "/billing", "/reports", "/admin"]),
    );
    expect(canAccessPath(UserRole.OWNER, "/admin")).toBe(true);
  });

  it("DOCTOR has clinical + patients, not admin", () => {
    const hrefs = getNavItemsForRole(UserRole.DOCTOR).map((item) => item.href);
    expect(hrefs).toContain("/clinical");
    expect(hrefs).toContain("/patients");
    expect(hrefs).not.toContain("/admin");
    expect(canAccessPath(UserRole.DOCTOR, "/clinical")).toBe(true);
    expect(canAccessPath(UserRole.DOCTOR, "/admin")).toBe(false);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.billing.write)).toBe(false);
  });

  it("NURSE has clinical chart read, not billing or clinic-wide reports", () => {
    expect(canAccessPath(UserRole.NURSE, "/clinical")).toBe(true);
    expect(canAccessPath(UserRole.NURSE, "/billing")).toBe(false);
    expect(canAccessPath(UserRole.NURSE, "/reports")).toBe(false);
    expect(canAccessPath(UserRole.NURSE, "/dashboard")).toBe(true);
    expect(hasPermission(UserRole.NURSE, PERMISSIONS.clinical_chart.write)).toBe(false);
    expect(hasPermission(UserRole.NURSE, PERMISSIONS.billing.write)).toBe(false);
    expect(hasPermission(UserRole.NURSE, PERMISSIONS.billing.read)).toBe(false);
    const hrefs = getNavItemsForRole(UserRole.NURSE).map((item) => item.href);
    expect(hrefs).not.toContain("/billing");
    expect(hrefs).not.toContain("/reports");
  });

  it("RECEPTIONIST has front office and billing read, not inventory or clinical chart", () => {
    expect(canAccessPath(UserRole.RECEPTIONIST, "/reception")).toBe(true);
    expect(canAccessPath(UserRole.RECEPTIONIST, "/appointments")).toBe(true);
    expect(canAccessPath(UserRole.RECEPTIONIST, "/billing")).toBe(true);
    expect(canAccessPath(UserRole.RECEPTIONIST, "/reports")).toBe(false);
    expect(canAccessPath(UserRole.RECEPTIONIST, "/inventory")).toBe(false);
    expect(canAccessPath(UserRole.RECEPTIONIST, "/clinical")).toBe(false);
    expect(hasPermission(UserRole.RECEPTIONIST, PERMISSIONS.clinical_chart.read)).toBe(false);
    expect(hasPermission(UserRole.RECEPTIONIST, PERMISSIONS.appointments.write)).toBe(true);
    expect(hasPermission(UserRole.RECEPTIONIST, PERMISSIONS.billing.write)).toBe(false);
    expect(hasPermission(UserRole.RECEPTIONIST, PERMISSIONS.billing.read)).toBe(true);
    expect(hasPermission(UserRole.RECEPTIONIST, PERMISSIONS.inventory.write)).toBe(false);
    const hrefs = getNavItemsForRole(UserRole.RECEPTIONIST).map((item) => item.href);
    expect(hrefs).toContain("/billing");
    expect(hrefs).not.toContain("/inventory");
    expect(hrefs).not.toContain("/reports");
  });

  it("FINANCE has billing write and clinic-wide reports, not clinical", () => {
    expect(canAccessPath(UserRole.FINANCE, "/billing")).toBe(true);
    expect(canAccessPath(UserRole.FINANCE, "/reports")).toBe(true);
    expect(canAccessPath(UserRole.FINANCE, "/clinical")).toBe(false);
    expect(hasPermission(UserRole.FINANCE, PERMISSIONS.billing.write)).toBe(true);
    expect(hasPermission(UserRole.FINANCE, PERMISSIONS.reports.export)).toBe(true);
    expect(hasPermission(UserRole.FINANCE, PERMISSIONS.clinical_schedule.read)).toBe(false);
  });

  it("DOCTOR keeps billing read and dashboard, not clinic-wide /reports export", () => {
    expect(canAccessPath(UserRole.DOCTOR, "/billing")).toBe(true);
    expect(canAccessPath(UserRole.DOCTOR, "/reports")).toBe(false);
    expect(canAccessPath(UserRole.DOCTOR, "/dashboard")).toBe(true);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.billing.read)).toBe(true);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.billing.write)).toBe(false);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.reports.export)).toBe(false);
  });

  it("HR self-service is identity-scoped; directory is admin-only", () => {
    expect(canAccessPath(UserRole.STORE, "/hr/me")).toBe(true);
    expect(canAccessPath(UserRole.DOCTOR, "/hr/me")).toBe(true);
    expect(canAccessPath(UserRole.DOCTOR, "/hr")).toBe(false);
    expect(canAccessPath(UserRole.ADMIN, "/hr")).toBe(true);
  });
});

describe("Finding 3 — post-login /dashboard is confirmed-intentional", () => {
  it("login destination is hardcoded /dashboard; getRoleHomePath is bounce-only", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/auth/post-login-redirect.ts", "utf8");
    expect(src).toContain('url: "/dashboard"');
    expect(src).not.toContain("getRoleHomePath");
    const guard = await fs.readFile("src/lib/rbac/require-route-access.ts", "utf8");
    expect(guard).toContain("getRoleHomePath");
  });
});
