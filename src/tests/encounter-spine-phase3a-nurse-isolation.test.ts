/**
 * Action-level permission isolation for Module 6 Phase 3a nurse chairside.
 *
 * Same injected-TenantContext pattern as
 * `front-office-insurance-action-isolation.test.ts`: mock
 * `requireTenantContext` and invoke real spine server actions. Route-guard /
 * UI-redirect checks are not sufficient — they do not prove action-level
 * enforcement.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import type { TenantContext } from "@/lib/tenant/context";

const mockRequireTenantContext = vi.hoisted(() => vi.fn());
const mockEncounterFindFirst = vi.hoisted(() => vi.fn());
const mockEncounterUpdate = vi.hoisted(() => vi.fn());
const mockClinicalNoteCreate = vi.hoisted(() => vi.fn());
const mockLineFindFirst = vi.hoisted(() => vi.fn());
const mockRiskFindFirst = vi.hoisted(() => vi.fn());
const mockConsentFindFirst = vi.hoisted(() => vi.fn());
const mockCreateRisk = vi.hoisted(() => vi.fn());
const mockUpdateRisk = vi.hoisted(() => vi.fn());
const mockCreateConsent = vi.hoisted(() => vi.fn());
const mockApplyPreAuthOverride = vi.hoisted(() => vi.fn());
const mockLogMaterialUsage = vi.hoisted(() => vi.fn());
const mockCreateAuditLog = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenant/context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant/context")>();
  return {
    ...actual,
    requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    encounter: {
      findFirst: (...a: unknown[]) => mockEncounterFindFirst(...a),
      update: (...a: unknown[]) => mockEncounterUpdate(...a),
    },
    clinicalNote: { create: (...a: unknown[]) => mockClinicalNoteCreate(...a) },
    encounterProcedureLine: { findFirst: (...a: unknown[]) => mockLineFindFirst(...a) },
    riskAssessment: { findFirst: (...a: unknown[]) => mockRiskFindFirst(...a) },
    consentRecord: { findFirst: (...a: unknown[]) => mockConsentFindFirst(...a) },
  },
}));

vi.mock("@/lib/encounter/gate-enforcement", () => ({
  applyPreAuthOverride: (...a: unknown[]) => mockApplyPreAuthOverride(...a),
  buildLiveGateSummary: vi.fn(),
  assertRiskClearedForEncounter: vi.fn(),
}));

vi.mock("@/lib/encounter/repository", () => ({
  createRiskAssessmentAudited: (...a: unknown[]) => mockCreateRisk(...a),
  updateRiskAssessmentAudited: (...a: unknown[]) => mockUpdateRisk(...a),
  createConsentRecordAudited: (...a: unknown[]) => mockCreateConsent(...a),
  createInsuranceVerificationAudited: vi.fn(),
  updateInsuranceVerificationAudited: vi.fn(),
}));

vi.mock("@/lib/encounter/procedure-execution", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/encounter/procedure-execution")>();
  return {
    ...actual,
    logMaterialUsage: (...a: unknown[]) => mockLogMaterialUsage(...a),
  };
});

vi.mock("@/lib/actions/safe-action", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/actions/safe-action")>();
  return {
    ...actual,
    createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
  };
});

function staffContext(role: UserRole, idSuffix: string): TenantContext {
  const staffMember = {
    id: `staff_${idSuffix}`,
    tenantId: "tenant_test",
    authUserId: `user_${idSuffix}`,
    email: `${idSuffix}@example.com`,
    firstName: idSuffix,
    lastName: "User",
    avatarUrl: null,
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as TenantContext["staffMember"];

  return {
    tenant: {
      id: "tenant_test",
      name: "Test Clinic",
      slug: "test-clinic",
      email: null,
      phone: null,
      address: null,
      city: null,
      country: null,
      timezone: "UTC",
      logoUrl: null,
      subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      onboardingCompleted: true,
      status: TenantStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      featureFlags: { ENCOUNTER_SPINE_ENABLED: true },
    } as TenantContext["tenant"],
    staffMember,
    user: staffMember,
    authUserId: `user_${idSuffix}`,
    tenantSlug: "test-clinic",
    tenantId: "tenant_test",
    isSuperAdmin: false,
    trial: {
      isTrialing: false,
      daysRemaining: 0,
      trialEndsAt: null,
      isExpired: false,
    },
    countryProfile: {} as TenantContext["countryProfile"],
    currency: "AED",
    taxRate: 5,
    taxName: "VAT",
  };
}

function nurseContext(): TenantContext {
  return staffContext(UserRole.NURSE, "nurse");
}

function dentistContext(): TenantContext {
  return staffContext(UserRole.DENTIST, "dentist");
}

function adminContext(): TenantContext {
  return staffContext(UserRole.ADMIN, "admin");
}

const OWNED = {
  id: "enc_test",
  appointmentId: "appt_test",
  patientId: "pat_test",
};

const LINE = {
  id: "line_test",
  encounter: { appointmentId: "appt_test" },
};

const EXAM_INPUT = {
  encounterId: "enc_test",
  chiefComplaint: "Pain",
  findings: "Caries",
  provisionalDiagnosis: "K02.9",
};

const CONSUMABLE_LOG = {
  procedureLineId: "line_test",
  itemId: "item_gauze",
  tier: "consumable" as const,
  quantity: 1,
};

const TRACKED_LOG = {
  procedureLineId: "line_test",
  itemId: "item_handpiece",
  tier: "tracked" as const,
  quantity: 1,
};

describe("Phase 3a nurse — action-level permission isolation", () => {
  const ACTION_MS = 120_000;

  let clearSpineRisk: typeof import("@/app/(dashboard)/features/clinical/encounter-spine-actions").clearSpineRisk;
  let grantSpineConsent: typeof import("@/app/(dashboard)/features/clinical/encounter-spine-actions").grantSpineConsent;
  let completeSpineExam: typeof import("@/app/(dashboard)/features/clinical/encounter-spine-actions").completeSpineExam;
  let overrideSpinePreAuth: typeof import("@/app/(dashboard)/features/clinical/encounter-spine-actions").overrideSpinePreAuth;
  let logSpineMaterial: typeof import("@/app/(dashboard)/features/clinical/encounter-spine-actions").logSpineMaterial;

  beforeAll(async () => {
    process.env.ENCOUNTER_SPINE_ENABLED = "true";
    const spine = await import(
      "@/app/(dashboard)/features/clinical/encounter-spine-actions"
    );
    clearSpineRisk = spine.clearSpineRisk;
    grantSpineConsent = spine.grantSpineConsent;
    completeSpineExam = spine.completeSpineExam;
    overrideSpinePreAuth = spine.overrideSpinePreAuth;
    logSpineMaterial = spine.logSpineMaterial;
  }, ACTION_MS);

  beforeEach(() => {
    process.env.ENCOUNTER_SPINE_ENABLED = "true";
    mockRequireTenantContext.mockReset();
    mockRequireTenantContext.mockResolvedValue(nurseContext());
    mockEncounterFindFirst.mockReset();
    mockEncounterFindFirst.mockResolvedValue(OWNED);
    mockEncounterUpdate.mockReset();
    mockEncounterUpdate.mockResolvedValue(OWNED);
    mockClinicalNoteCreate.mockReset();
    mockClinicalNoteCreate.mockResolvedValue({ id: "note_exam" });
    mockLineFindFirst.mockReset();
    mockLineFindFirst.mockResolvedValue(LINE);
    mockRiskFindFirst.mockReset();
    mockRiskFindFirst.mockResolvedValue(null);
    mockConsentFindFirst.mockReset();
    mockConsentFindFirst.mockResolvedValue(null);
    mockCreateRisk.mockReset();
    mockCreateRisk.mockResolvedValue({ id: "risk_1" });
    mockUpdateRisk.mockReset();
    mockCreateConsent.mockReset();
    mockCreateConsent.mockResolvedValue({ id: "consent_1" });
    mockApplyPreAuthOverride.mockReset();
    mockApplyPreAuthOverride.mockResolvedValue(undefined);
    mockLogMaterialUsage.mockReset();
    mockLogMaterialUsage.mockResolvedValue({
      id: "mu_1",
      tenantId: "tenant_test",
      procedureLineId: "line_test",
      itemId: "item_gauze",
      tier: "consumable",
      quantity: 1,
    });
    mockCreateAuditLog.mockReset();
    mockCreateAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.ENCOUNTER_SPINE_ENABLED;
    vi.clearAllMocks();
  });

  async function expectForbidden(fn: () => Promise<unknown>) {
    let caught: unknown;
    try {
      await fn();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("FORBIDDEN");
  }

  it("denies clearSpineRisk for NURSE", async () => {
    await expectForbidden(() => clearSpineRisk({ encounterId: "enc_test", asaClass: "II" }));
    expect(mockCreateRisk).not.toHaveBeenCalled();
  }, ACTION_MS);

  it("denies grantSpineConsent for NURSE", async () => {
    await expectForbidden(() => grantSpineConsent({ encounterId: "enc_test" }));
    expect(mockCreateConsent).not.toHaveBeenCalled();
  }, ACTION_MS);

  it("denies completeSpineExam for NURSE", async () => {
    await expectForbidden(() => completeSpineExam(EXAM_INPUT));
    expect(mockClinicalNoteCreate).not.toHaveBeenCalled();
    expect(mockEncounterUpdate).not.toHaveBeenCalled();
  }, ACTION_MS);

  it("denies overrideSpinePreAuth for NURSE", async () => {
    await expectForbidden(() =>
      overrideSpinePreAuth({
        encounterId: "enc_test",
        reason: "Nurse must not override",
        patientAcknowledged: true,
      }),
    );
    expect(mockApplyPreAuthOverride).not.toHaveBeenCalled();
  }, ACTION_MS);

  it("allows logSpineMaterial consumable-tier for NURSE", async () => {
    const result = await logSpineMaterial(CONSUMABLE_LOG);
    expect(result).toMatchObject({ ok: true });
    expect(mockLogMaterialUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant_test",
        procedureLineId: "line_test",
        itemId: "item_gauze",
        tier: "consumable",
        quantity: 1,
      }),
    );
  }, ACTION_MS);

  it("denies logSpineMaterial tracked-tier for NURSE", async () => {
    await expectForbidden(() => logSpineMaterial(TRACKED_LOG));
    expect(mockLogMaterialUsage).not.toHaveBeenCalled();
  }, ACTION_MS);

  it("allows denied-for-nurse actions for DENTIST (control)", async () => {
    mockRequireTenantContext.mockResolvedValue(dentistContext());

    await expect(clearSpineRisk({ encounterId: "enc_test", asaClass: "II" })).resolves.toEqual({
      ok: true,
    });
    await expect(grantSpineConsent({ encounterId: "enc_test" })).resolves.toMatchObject({
      id: "consent_1",
    });
    await expect(completeSpineExam(EXAM_INPUT)).resolves.toEqual({ noteId: "note_exam" });
    await expect(
      overrideSpinePreAuth({
        encounterId: "enc_test",
        reason: "Dentist override control",
        patientAcknowledged: true,
      }),
    ).resolves.toEqual({ ok: true });

    expect(mockCreateRisk).toHaveBeenCalled();
    expect(mockCreateConsent).toHaveBeenCalled();
    expect(mockClinicalNoteCreate).toHaveBeenCalled();
    expect(mockApplyPreAuthOverride).toHaveBeenCalled();
  }, ACTION_MS);

  it("allows both material tiers for DENTIST (control)", async () => {
    mockRequireTenantContext.mockResolvedValue(dentistContext());
    await expect(logSpineMaterial(CONSUMABLE_LOG)).resolves.toMatchObject({ ok: true });
    await expect(logSpineMaterial(TRACKED_LOG)).resolves.toMatchObject({ ok: true });
    expect(mockLogMaterialUsage).toHaveBeenCalledTimes(2);
  }, ACTION_MS);

  it("allows denied-for-nurse actions for ADMIN (control)", async () => {
    mockRequireTenantContext.mockResolvedValue(adminContext());

    await expect(clearSpineRisk({ encounterId: "enc_test", asaClass: "II" })).resolves.toEqual({
      ok: true,
    });
    await expect(grantSpineConsent({ encounterId: "enc_test" })).resolves.toMatchObject({
      id: "consent_1",
    });
    await expect(completeSpineExam(EXAM_INPUT)).resolves.toEqual({ noteId: "note_exam" });
    await expect(
      overrideSpinePreAuth({
        encounterId: "enc_test",
        reason: "Admin override control",
        patientAcknowledged: true,
      }),
    ).resolves.toEqual({ ok: true });
    await expect(logSpineMaterial(CONSUMABLE_LOG)).resolves.toMatchObject({ ok: true });
    await expect(logSpineMaterial(TRACKED_LOG)).resolves.toMatchObject({ ok: true });
  }, ACTION_MS);
});
