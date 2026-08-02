import { describe, expect, it } from "vitest";
import { assertExamCompleteForGatesTransition } from "@/lib/encounter/exam";
import { aggregateChairPrepMaterials } from "@/lib/encounter/chair-prep";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { UserRole } from "@prisma/client";

describe("Module 6 Phase 3a", () => {
  it("blocks gates until exam fields are complete", () => {
    expect(() => assertExamCompleteForGatesTransition({
      examCompletedAt: null,
      examinedByStaffId: null,
    })).toThrow(/Complete the chief complaint/);
    expect(() => assertExamCompleteForGatesTransition({
      examCompletedAt: new Date(),
      examinedByStaffId: "staff-1",
    })).not.toThrow();
  });

  it("aggregates BOM materials per chair and ignores procedures without BOM", () => {
    expect(aggregateChairPrepMaterials([{ chairId: "chair-1", procedureCatalogId: "no-bom" }], [])).toEqual({
      "chair-1": [],
    });
    expect(aggregateChairPrepMaterials(
      [
        { chairId: "chair-1", procedureCatalogId: "p1" },
        { chairId: "chair-1", procedureCatalogId: "p2", quantity: 2 },
      ],
      [
        { procedureCatalogId: "p1", inventoryItemId: "gauze", itemName: "Gauze", unit: "pack", quantity: 1 },
        { procedureCatalogId: "p2", inventoryItemId: "gauze", itemName: "Gauze", unit: "pack", quantity: 3 },
      ],
    )["chair-1"][0]?.quantity).toBe(7);
  });

  it("allows nurse assistance but not clinical chart write", () => {
    expect(hasPermission(UserRole.NURSE, PERMISSIONS.clinical_assist.write)).toBe(true);
    expect(hasPermission(UserRole.NURSE, PERMISSIONS.clinical_chart.write)).toBe(false);
  });
});
