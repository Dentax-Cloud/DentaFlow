import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UserRole } from "@prisma/client";
import { hasPermission, PERMISSIONS, can } from "@/lib/rbac/permissions";
import { canOverridePreAuth } from "@/lib/encounter/gates";

/** Mirrors the server/UI gate for insurance approve/edit after the role-scope fix. */
function canApproveOrEditInsurance(role: UserRole): boolean {
  return hasPermission(role, PERMISSIONS.insurance.write);
}

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

  it("does not let doctors approve/edit insurance via clinical_chart.write", () => {
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.clinical_chart.write)).toBe(true);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.insurance.write)).toBe(false);
    expect(canApproveOrEditInsurance(UserRole.DOCTOR)).toBe(false);
    expect(canApproveOrEditInsurance(UserRole.DENTIST)).toBe(false);
    expect(canApproveOrEditInsurance(UserRole.RECEPTIONIST)).toBe(true);
  });

  it("keeps pre-auth override as a separate doctor-capable path", () => {
    expect(canOverridePreAuth(UserRole.DOCTOR)).toBe(true);
    expect(canOverridePreAuth(UserRole.DENTIST)).toBe(true);
    expect(canOverridePreAuth(UserRole.RECEPTIONIST)).toBe(false);
    expect(canApproveOrEditInsurance(UserRole.DOCTOR)).toBe(false);
  });
});

describe("front-office insurance action isolation (static)", () => {
  const actionPath = resolve(
    "src/app/(dashboard)/features/reception/insurance-verification-actions.ts",
  );
  const spinePath = resolve(
    "src/app/(dashboard)/features/clinical/encounter-spine-actions.ts",
  );
  const spinePagePath = resolve(
    "src/app/(dashboard)/clinical/encounter/[appointmentId]/spine/page.tsx",
  );
  const spineClientPath = resolve(
    "src/app/(dashboard)/clinical/encounter/[appointmentId]/spine/spine-workspace-client.tsx",
  );
  const actionSrc = readFileSync(actionPath, "utf8");
  const spineSrc = readFileSync(spinePath, "utf8");
  const spinePageSrc = readFileSync(spinePagePath, "utf8");
  const spineClientSrc = readFileSync(spineClientPath, "utf8");

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

  it("front-office and spine insurance upserts require insurance.write only", () => {
    expect(actionSrc.includes("PERMISSIONS.clinical_chart.write")).toBe(false);
    expect(actionSrc.includes("PERMISSIONS.insurance.write")).toBe(true);

    const upsertIdx = spineSrc.indexOf("export async function upsertSpineInsuranceVerification");
    const slice = spineSrc.slice(upsertIdx, upsertIdx + 900);
    expect(slice.includes("requireSpineInsuranceWrite") || slice.includes("PERMISSIONS.insurance.write")).toBe(
      true,
    );
    expect(slice.includes("requireSpineWrite()")).toBe(false);
  });

  it("spine UI gates insurance save on canWriteInsurance, override on canWrite", () => {
    expect(spinePageSrc.includes("canWriteInsurance")).toBe(true);
    expect(spinePageSrc.includes("PERMISSIONS.insurance.write")).toBe(true);
    expect(spineClientSrc.includes("canWriteInsurance")).toBe(true);
    expect(spineClientSrc.includes("Save insurance verification")).toBe(true);
    // Insurance block must not be keyed only on canWrite
    const insuranceBlock = spineClientSrc.slice(
      spineClientSrc.indexOf("Insurance verification"),
      spineClientSrc.indexOf("Insurance verification") + 400,
    );
    expect(spineClientSrc.includes("{canWriteInsurance ? (")).toBe(true);
    expect(insuranceBlock.includes("canWriteInsurance") || spineClientSrc.includes("canWriteInsurance ?")).toBe(
      true,
    );
    expect(spineClientSrc.includes("Override pre-auth")).toBe(true);
  });
});
