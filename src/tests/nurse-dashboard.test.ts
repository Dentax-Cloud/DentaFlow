import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UserRole } from "@prisma/client";
import { normalizeDashboardRole } from "@/lib/rbac/permissions";

describe("Nurse dashboard wiring", () => {
  it("maps NURSE to its own dashboard role (not DOCTOR/RECEPTIONIST)", () => {
    expect(normalizeDashboardRole(UserRole.NURSE)).toBe("NURSE");
    expect(normalizeDashboardRole(UserRole.NURSE)).not.toBe("DOCTOR");
    expect(normalizeDashboardRole(UserRole.NURSE)).not.toBe("RECEPTIONIST");
  });

  it("renders an isNurseView branch in DashboardClient", () => {
    const src = readFileSync(
      resolve(__dirname, "../app/(dashboard)/dashboard/dashboard-client.tsx"),
      "utf8",
    );
    expect(src).toContain('dashboardRole === "NURSE"');
    expect(src).toContain("isNurseView");
    expect(src).toMatch(/isNurseView\s*&&/);
  });
});
