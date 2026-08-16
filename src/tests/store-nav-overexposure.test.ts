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
