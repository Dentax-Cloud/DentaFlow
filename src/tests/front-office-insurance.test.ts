import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UserRole } from "@prisma/client";
import { hasPermission, PERMISSIONS, can } from "@/lib/rbac/permissions";

describe("front-office insurance verification permissions", () => {
  it("grants insurance.write to receptionist only among clinical/front-office roles", () => {
    expect(hasPermission(UserRole.RECEPTIONIST, PERMISSIONS.insurance.write)).toBe(true);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.insurance.write)).toBe(false);
    expect(hasPermission(UserRole.NURSE, PERMISSIONS.insurance.write)).toBe(false);
    expect(hasPermission(UserRole.FINANCE, PERMISSIONS.insurance.write)).toBe(false);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.insurance.write)).toBe(true);
  });

  it("does not broaden receptionist clinical_chart access", () => {
    expect(can(UserRole.RECEPTIONIST, "write", "clinical_chart")).toBe(false);
    expect(can(UserRole.RECEPTIONIST, "read", "clinical_chart")).toBe(false);
    expect(hasPermission(UserRole.RECEPTIONIST, PERMISSIONS.clinical_chart.write)).toBe(false);
  });

  it("lets doctors use the new action via clinical_chart.write without insurance.write", () => {
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.clinical_chart.write)).toBe(true);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.insurance.write)).toBe(false);
    const allowed =
      hasPermission(UserRole.DOCTOR, PERMISSIONS.insurance.write) ||
      hasPermission(UserRole.DOCTOR, PERMISSIONS.clinical_chart.write);
    expect(allowed).toBe(true);
  });
});

describe("front-office insurance action isolation (static)", () => {
  const actionPath = resolve(
    "src/app/(dashboard)/features/reception/insurance-verification-actions.ts",
  );
  const spinePath = resolve(
    "src/app/(dashboard)/features/clinical/encounter-spine-actions.ts",
  );
  const actionSrc = readFileSync(actionPath, "utf8");
  const spineSrc = readFileSync(spinePath, "utf8");

  it("front-office action never calls assertRiskClearedForEncounter", () => {
    expect(actionSrc.includes("assertRiskClearedForEncounter(")).toBe(false);
    expect(actionSrc.includes("from \"@/lib/encounter/gate-enforcement\"")).toBe(false);
  });

  it("front-office action reuses createEncounterFromAppointment and audited insurance helpers", () => {
    expect(actionSrc.includes("createEncounterFromAppointment")).toBe(true);
    expect(actionSrc.includes("createInsuranceVerificationAudited")).toBe(true);
    expect(actionSrc.includes("updateInsuranceVerificationAudited")).toBe(true);
    expect(actionSrc.includes("isEncounterSpineEnabled")).toBe(true);
    expect(actionSrc.includes("serializeDecimal")).toBe(true);
  });

  it("doctor spine upsert still asserts risk cleared", () => {
    expect(spineSrc.includes("export async function upsertSpineInsuranceVerification")).toBe(
      true,
    );
    const upsertIdx = spineSrc.indexOf("export async function upsertSpineInsuranceVerification");
    const slice = spineSrc.slice(upsertIdx, upsertIdx + 1200);
    expect(slice.includes("assertRiskClearedForEncounter")).toBe(true);
    expect(slice.includes("requirePermission(PERMISSIONS.clinical_chart.write)") || slice.includes("requireSpineWrite")).toBe(true);
  });
});
