/**
 * Action-level permission isolation for Module 6 front-office insurance.
 *
 * Reuses the same injected TenantContext shape as
 * `server-actions.integration.test.ts` (__setTestTenantContext), applied via
 * mocking `requireTenantContext` so spine/"use server" actions that call it
 * directly (not through createAction) run under a RECEPTIONIST role.
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
const mockAppointmentFindFirst = vi.hoisted(() => vi.fn());
const mockCreateEncounterFromAppointment = vi.hoisted(() => vi.fn());
const mockCreateInsuranceVerificationAudited = vi.hoisted(() => vi.fn());
const mockUpdateInsuranceVerificationAudited = vi.hoisted(() => vi.fn());
const mockInsuranceFindFirst = vi.hoisted(() => vi.fn());
const mockSettingsFindUnique = vi.hoisted(() => vi.fn());
const mockTenantFindFirst = vi.hoisted(() => vi.fn());
const mockEncounterFindFirst = vi.hoisted(() => vi.fn());
const mockApplyPreAuthOverride = vi.hoisted(() => vi.fn());

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
    appointment: { findFirst: (...a: unknown[]) => mockAppointmentFindFirst(...a) },
    insuranceVerification: { findFirst: (...a: unknown[]) => mockInsuranceFindFirst(...a) },
    settings: { findUnique: (...a: unknown[]) => mockSettingsFindUnique(...a) },
    tenant: { findFirst: (...a: unknown[]) => mockTenantFindFirst(...a) },
    riskAssessment: { findFirst: vi.fn() },
    encounter: { findFirst: (...a: unknown[]) => mockEncounterFindFirst(...a) },
  },
}));

vi.mock("@/lib/encounter/gate-enforcement", () => ({
  applyPreAuthOverride: (...a: unknown[]) => mockApplyPreAuthOverride(...a),
  buildLiveGateSummary: vi.fn(),
  assertRiskClearedForEncounter: vi.fn(),
}));

vi.mock("@/lib/encounter/lifecycle", () => ({
  createEncounterFromAppointment: (...a: unknown[]) =>
    mockCreateEncounterFromAppointment(...a),
}));

vi.mock("@/lib/encounter/repository", () => ({
  createInsuranceVerificationAudited: (...a: unknown[]) =>
    mockCreateInsuranceVerificationAudited(...a),
  updateInsuranceVerificationAudited: (...a: unknown[]) =>
    mockUpdateInsuranceVerificationAudited(...a),
  createRiskAssessmentAudited: vi.fn(),
  updateRiskAssessmentAudited: vi.fn(),
  createConsentRecordAudited: vi.fn(),
}));

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

function receptionistContext(): TenantContext {
  return staffContext(UserRole.RECEPTIONIST, "reception");
}

function doctorContext(): TenantContext {
  return staffContext(UserRole.DOCTOR, "doctor");
}

describe("front-office insurance — action-level permission isolation", () => {
  // Spine actions module is large; first import under parallel suite load can exceed 20s.
  const ACTION_MS = 60_000;

  let clearSpineRisk: typeof import("@/app/(dashboard)/features/clinical/encounter-spine-actions").clearSpineRisk;
  let upsertSpineInsuranceVerification: typeof import("@/app/(dashboard)/features/clinical/encounter-spine-actions").upsertSpineInsuranceVerification;
  let overrideSpinePreAuth: typeof import("@/app/(dashboard)/features/clinical/encounter-spine-actions").overrideSpinePreAuth;
  let grantSpineConsent: typeof import("@/app/(dashboard)/features/clinical/encounter-spine-actions").grantSpineConsent;
  let upsertFrontOfficeInsuranceVerification: typeof import("@/app/(dashboard)/features/reception/insurance-verification-actions").upsertFrontOfficeInsuranceVerification;

  beforeAll(async () => {
    process.env.ENCOUNTER_SPINE_ENABLED = "true";
    const spine = await import(
      "@/app/(dashboard)/features/clinical/encounter-spine-actions"
    );
    clearSpineRisk = spine.clearSpineRisk;
    upsertSpineInsuranceVerification = spine.upsertSpineInsuranceVerification;
    overrideSpinePreAuth = spine.overrideSpinePreAuth;
    grantSpineConsent = spine.grantSpineConsent;
    ({ upsertFrontOfficeInsuranceVerification } = await import(
      "@/app/(dashboard)/features/reception/insurance-verification-actions"
    ));
  }, ACTION_MS);

  beforeEach(() => {
    process.env.ENCOUNTER_SPINE_ENABLED = "true";
    mockRequireTenantContext.mockReset();
    mockRequireTenantContext.mockResolvedValue(receptionistContext());
    mockAppointmentFindFirst.mockReset();
    mockCreateEncounterFromAppointment.mockReset();
    mockCreateInsuranceVerificationAudited.mockReset();
    mockUpdateInsuranceVerificationAudited.mockReset();
    mockInsuranceFindFirst.mockReset();
    mockSettingsFindUnique.mockReset();
    mockTenantFindFirst.mockReset();
    mockEncounterFindFirst.mockReset();
    mockApplyPreAuthOverride.mockReset();
  });

  afterEach(() => {
    delete process.env.ENCOUNTER_SPINE_ENABLED;
    vi.clearAllMocks();
  });

  it(
    "denies clearSpineRisk (clinical_chart.write) for RECEPTIONIST",
    async () => {
      let caught: unknown;
      try {
        await clearSpineRisk({ encounterId: "enc_test", asaClass: "II" });
      } catch (e) {
        caught = e;
      }

      // eslint-disable-next-line no-console
      console.log("[isolation] clearSpineRisk →", {
        type: caught instanceof Error ? caught.constructor.name : typeof caught,
        message: caught instanceof Error ? caught.message : caught,
      });

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe("FORBIDDEN");
    },
    ACTION_MS,
  );

  it(
    "denies upsertSpineInsuranceVerification for DOCTOR (no insurance.write)",
    async () => {
      mockRequireTenantContext.mockResolvedValue(doctorContext());
      let caught: unknown;
      try {
        await upsertSpineInsuranceVerification({
          encounterId: "enc_test",
          eligibilityStatus: "eligible",
          preAuthStatus: "not_required",
          estimatedCoverage: 80,
          estimatedCopay: 50,
        });
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe("FORBIDDEN");
    },
    ACTION_MS,
  );

  it(
    "denies upsertFrontOfficeInsuranceVerification for DOCTOR (no insurance.write)",
    async () => {
      mockRequireTenantContext.mockResolvedValue(doctorContext());
      let caught: unknown;
      try {
        await upsertFrontOfficeInsuranceVerification({
          appointmentId: "appt_test",
          eligibilityStatus: "eligible",
          preAuthStatus: "not_required",
        });
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe("FORBIDDEN");
      expect(mockCreateInsuranceVerificationAudited).not.toHaveBeenCalled();
    },
    ACTION_MS,
  );

  it(
    "allows upsertFrontOfficeInsuranceVerification for RECEPTIONIST (insurance.write)",
    async () => {
      mockAppointmentFindFirst.mockResolvedValue({
        id: "appt_test",
        patientId: "pat_test",
      });
      mockCreateEncounterFromAppointment.mockResolvedValue({
        id: "enc_created",
        status: "arrival_intake",
        appointmentId: "appt_test",
      });
      mockSettingsFindUnique.mockResolvedValue({ encounterSpineSettings: null });
      mockTenantFindFirst.mockResolvedValue({
        featureFlags: { ENCOUNTER_SPINE_ENABLED: true },
      });
      mockInsuranceFindFirst.mockResolvedValue(null);
      mockCreateInsuranceVerificationAudited.mockResolvedValue({
        id: "iv_1",
        eligibilityStatus: "eligible",
        preAuthStatus: "not_required",
        estimatedCoverage: 80,
        estimatedCopay: 50,
        verifiedAt: new Date(),
      });

      const result = await upsertFrontOfficeInsuranceVerification({
        appointmentId: "appt_test",
        eligibilityStatus: "eligible",
        preAuthStatus: "not_required",
        estimatedCoverage: 80,
        estimatedCopay: 50,
      });

      // eslint-disable-next-line no-console
      console.log("[isolation] upsertFrontOfficeInsuranceVerification →", result);

      expect(result.encounterId).toBe("enc_created");
      expect(result.encounterStatus).toBe("arrival_intake");
      expect(mockCreateInsuranceVerificationAudited).toHaveBeenCalled();
    },
    ACTION_MS,
  );

  it(
    "denies grantSpineConsent (another clinical_chart.write action) for RECEPTIONIST",
    async () => {
      // Picked grantSpineConsent: also requireSpineWrite / clinical_chart.write,
      // and is a peer of clearSpineRisk on the doctor spine — good spot-check that
      // insurance.write did not broaden receptionist access to consent either.
      let caught: unknown;
      try {
        await grantSpineConsent({ encounterId: "enc_test" });
      } catch (e) {
        caught = e;
      }

      // eslint-disable-next-line no-console
      console.log("[isolation] grantSpineConsent →", {
        type: caught instanceof Error ? caught.constructor.name : typeof caught,
        message: caught instanceof Error ? caught.message : caught,
      });

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe("FORBIDDEN");
    },
    ACTION_MS,
  );

  it(
    "allows overrideSpinePreAuth for DOCTOR (separate from insurance approve)",
    async () => {
      mockRequireTenantContext.mockResolvedValue(doctorContext());
      mockEncounterFindFirst.mockResolvedValue({
        id: "enc_test",
        appointmentId: "appt_test",
        patientId: "pat_test",
      });
      mockApplyPreAuthOverride.mockResolvedValue(undefined);

      const result = await overrideSpinePreAuth({
        encounterId: "enc_test",
        reason: "Patient accepted cash pay after denial",
        patientAcknowledged: true,
      });

      expect(result).toEqual({ ok: true });
      expect(mockApplyPreAuthOverride).toHaveBeenCalled();
    },
    ACTION_MS,
  );

  it(
    "denies overrideSpinePreAuth for RECEPTIONIST (needs clinical_chart.write)",
    async () => {
      mockRequireTenantContext.mockResolvedValue(receptionistContext());
      let caught: unknown;
      try {
        await overrideSpinePreAuth({
          encounterId: "enc_test",
          reason: "Should not work",
          patientAcknowledged: true,
        });
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe("FORBIDDEN");
      expect(mockApplyPreAuthOverride).not.toHaveBeenCalled();
    },
    ACTION_MS,
  );
});
