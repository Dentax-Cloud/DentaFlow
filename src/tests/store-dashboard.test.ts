import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UserRole } from "@prisma/client";
import { normalizeDashboardRole } from "@/lib/rbac/permissions";

describe("Store dashboard wiring", () => {
  it("maps STORE to its own dashboard role (not RECEPTIONIST)", () => {
    expect(normalizeDashboardRole(UserRole.STORE)).toBe("STORE");
    expect(normalizeDashboardRole(UserRole.STORE)).not.toBe("RECEPTIONIST");
  });

  it("renders an isStoreView branch in DashboardClient", () => {
    const src = readFileSync(
      resolve(__dirname, "../app/(dashboard)/dashboard/dashboard-client.tsx"),
      "utf8",
    );
    expect(src).toContain('dashboardRole === "STORE"');
    expect(src).toContain("isStoreView");
    expect(src).toMatch(/isStoreView\s*&&/);
    expect(src).toContain("StoreDashboardHome");
    // Receptionist front-desk must not fold STORE in anymore.
    expect(src).toMatch(
      /isFrontDeskView\s*=\s*dashboardRole\s*===\s*"RECEPTIONIST"/,
    );
    expect(src).not.toMatch(
      /isFrontDeskView\s*=\s*dashboardRole\s*===\s*"RECEPTIONIST"\s*\|\|\s*dashboardRole\s*===\s*"STORE"/,
    );
  });
});
