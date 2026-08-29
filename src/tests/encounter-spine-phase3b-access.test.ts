import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

const mockVisitShareFindUnique = vi.hoisted(() => vi.fn());
const mockVisitShareUpdate = vi.hoisted(() => vi.fn());
const mockEncounterFindFirst = vi.hoisted(() => vi.fn());
const mockImageFindMany = vi.hoisted(() => vi.fn());
const mockAuthFindUnique = vi.hoisted(() => vi.fn());
const mockStaffFindFirst = vi.hoisted(() => vi.fn());
const mockLineFindFirst = vi.hoisted(() => vi.fn());
const mockUpdateLineAudited = vi.hoisted(() => vi.fn());
const mockCompare = vi.hoisted(() => vi.fn());
const mockCreateAuditLog = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {
    encounterVisitShare: {
      findUnique: (...args: unknown[]) => mockVisitShareFindUnique(...args),
      update: (...args: unknown[]) => mockVisitShareUpdate(...args),
    },
    encounter: {
      findFirst: (...args: unknown[]) => mockEncounterFindFirst(...args),
    },
    clinicalImage: {
      findMany: (...args: unknown[]) => mockImageFindMany(...args),
    },
    auth_users: {
      findUnique: (...args: unknown[]) => mockAuthFindUnique(...args),
    },
    staffMember: {
      findFirst: (...args: unknown[]) => mockStaffFindFirst(...args),
    },
    encounterProcedureLine: {
      findFirst: (...args: unknown[]) => mockLineFindFirst(...args),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  compare: (...args: unknown[]) => mockCompare(...args),
}));

vi.mock("@/lib/actions/safe-action", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/encounter/repository", () => ({
  updateEncounterProcedureLineAudited: (...args: unknown[]) =>
    mockUpdateLineAudited(...args),
  createClinicalAlertAudited: vi.fn(),
  createEncounterProcedureBundleAudited: vi.fn(),
  createEncounterProcedureLineAudited: vi.fn(),
  updateEncounterAudited: vi.fn(),
}));

vi.mock("@/lib/encounter/gate-enforcement", () => ({
  assertProcedureStartGatesAllowed: vi.fn(),
}));

import { loadVisitSharePayload } from "@/lib/encounter/visit-share";
import { authenticateCosignProvider } from "@/lib/encounter/anaesthesia-cosign";
import { transitionProcedureLineStatus } from "@/lib/encounter/procedure-execution";
import { AnaesthesiaCosignError } from "@/lib/encounter/errors";

const TENANT_A = "tenant_a";
const TENANT_B = "tenant_b";
const PATIENT_A = "patient_a";
const PATIENT_B = "patient_b";
const ENCOUNTER_A = "enc_a";
const TOKEN_A = "a".repeat(32);
const TOKEN_B = "b".repeat(32);

function spineTenant(flags: Record<string, unknown> | null) {
  return {
    name: "Kensington Test",
    phone: "0200000000",
    email: "clinic@test.dentaflow.io",
    currencySymbol: "GBP",
    featureFlags: flags,
  };
}

describe("/visit/[token] access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENCOUNTER_SPINE_ENABLED;
    mockVisitShareUpdate.mockResolvedValue({});
    mockImageFindMany.mockResolvedValue([]);
  });

  it("returns payload for a valid in-date token on a flagged-on tenant", async () => {
    mockVisitShareFindUnique.mockResolvedValue({
      id: "share_a",
      tenantId: TENANT_A,
      encounterId: ENCOUNTER_A,
      expiresAt: new Date("2099-01-01"),
      tenant: spineTenant({ ENCOUNTER_SPINE_ENABLED: true }),
    });
    mockEncounterFindFirst.mockResolvedValue({
      id: ENCOUNTER_A,
      tenantId: TENANT_A,
      patientId: PATIENT_A,
      interruptOutcome: null,
      patient: { firstName: "Harry", lastName: "Smith" },
      consentRecords: [{ purpose: "clinical", revokedAt: null }],
      insuranceVerifications: [],
      procedureLines: [],
    });

    const payload = await loadVisitSharePayload(TOKEN_A, new Date("2026-08-16"));
    expect(payload).not.toBeNull();
    expect(payload?.patient.firstName).toBe("Harry");
    expect(payload?.consentItems.find((c) => c.purpose === "clinical")?.status).toBe(
      "granted",
    );
    expect(mockEncounterFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: ENCOUNTER_A,
          tenantId: TENANT_A,
          deletedAt: null,
        }),
      }),
    );
  });

  it("returns null for an expired token", async () => {
    mockVisitShareFindUnique.mockResolvedValue({
      id: "share_a",
      tenantId: TENANT_A,
      encounterId: ENCOUNTER_A,
      expiresAt: new Date("2020-01-01"),
      tenant: spineTenant({ ENCOUNTER_SPINE_ENABLED: true }),
    });
    const payload = await loadVisitSharePayload(TOKEN_A, new Date("2026-08-16"));
    expect(payload).toBeNull();
    expect(mockEncounterFindFirst).not.toHaveBeenCalled();
  });

  it("returns null for a wrong-tenant token (share tenant does not own the encounter)", async () => {
    mockVisitShareFindUnique.mockResolvedValue({
      id: "share_b",
      tenantId: TENANT_B,
      encounterId: ENCOUNTER_A,
      expiresAt: new Date("2099-01-01"),
      tenant: spineTenant({ ENCOUNTER_SPINE_ENABLED: true }),
    });
    mockEncounterFindFirst.mockResolvedValue(null);
    const payload = await loadVisitSharePayload(TOKEN_B, new Date("2026-08-16"));
    expect(payload).toBeNull();
    expect(mockEncounterFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: ENCOUNTER_A,
          tenantId: TENANT_B,
        }),
      }),
    );
  });

  it("does not load another patient's photos (query is tenant + encounter patient)", async () => {
    mockVisitShareFindUnique.mockResolvedValue({
      id: "share_a",
      tenantId: TENANT_A,
      encounterId: ENCOUNTER_A,
      expiresAt: new Date("2099-01-01"),
      tenant: spineTenant({ ENCOUNTER_SPINE_ENABLED: true }),
    });
    mockEncounterFindFirst.mockResolvedValue({
      id: ENCOUNTER_A,
      tenantId: TENANT_A,
      patientId: PATIENT_A,
      interruptOutcome: null,
      patient: { firstName: "Harry", lastName: "Smith" },
      consentRecords: [{ purpose: "clinical", revokedAt: null }],
      insuranceVerifications: [],
      procedureLines: [],
    });
    mockImageFindMany.mockResolvedValue([]);

    await loadVisitSharePayload(TOKEN_A, new Date("2026-08-16"));
    expect(mockImageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_A,
          patientId: PATIENT_A,
          patientShareable: true,
        }),
      }),
    );
    expect(mockImageFindMany.mock.calls[0][0].where.patientId).not.toBe(PATIENT_B);
  });

  it("returns null when the spine flag is off", async () => {
    mockVisitShareFindUnique.mockResolvedValue({
      id: "share_a",
      tenantId: TENANT_A,
      encounterId: ENCOUNTER_A,
      expiresAt: new Date("2099-01-01"),
      tenant: spineTenant({}),
    });
    const payload = await loadVisitSharePayload(TOKEN_A, new Date("2026-08-16"));
    expect(payload).toBeNull();
    expect(mockEncounterFindFirst).not.toHaveBeenCalled();
  });

  it("does not surface marketing-only-consented photos on the clinical visit view", async () => {
    mockVisitShareFindUnique.mockResolvedValue({
      id: "share_a",
      tenantId: TENANT_A,
      encounterId: ENCOUNTER_A,
      expiresAt: new Date("2099-01-01"),
      tenant: spineTenant({ ENCOUNTER_SPINE_ENABLED: true }),
    });
    mockEncounterFindFirst.mockResolvedValue({
      id: ENCOUNTER_A,
      tenantId: TENANT_A,
      patientId: PATIENT_A,
      interruptOutcome: null,
      patient: { firstName: "Harry", lastName: "Smith" },
      consentRecords: [{ purpose: "marketing", revokedAt: null }],
      insuranceVerifications: [],
      procedureLines: [],
    });
    mockImageFindMany.mockResolvedValue([
      {
        id: "img1",
        url: "https://example.com/a.jpg",
        fileName: "smile.jpg",
        photoCategory: "AFTER",
        notes: null,
        type: "PHOTO",
        patientShareable: true,
      },
    ]);

    const payload = await loadVisitSharePayload(TOKEN_A, new Date("2026-08-16"));
    expect(payload?.photos).toEqual([]);
    expect(payload?.consentItems.find((c) => c.purpose === "clinical")?.status).toBe(
      "pending",
    );
    expect(payload?.consentItems.find((c) => c.purpose === "marketing")?.status).toBe(
      "granted",
    );
  });
});

describe("anaesthesia co-sign authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStaffFindFirst.mockReset();
    mockAuthFindUnique.mockReset();
    mockCompare.mockReset();
  });

  it("blocks when no second-provider credentials are provided", async () => {
    await expect(
      authenticateCosignProvider({
        tenantId: TENANT_A,
        actorStaffId: "staff_a",
        credentials: null,
      }),
    ).rejects.toThrow(/No second provider is available/);
  });

  it("rejects the same user attempting both signatures", async () => {
    mockAuthFindUnique.mockResolvedValue({
      id: "auth_a",
      passwordHash: "hash",
    });
    mockCompare.mockResolvedValue(true);
    mockStaffFindFirst
      .mockResolvedValueOnce({
        id: "staff_a",
        role: UserRole.DOCTOR,
        authUserId: "auth_a",
      })
      .mockResolvedValueOnce({ authUserId: "auth_a" });

    await expect(
      authenticateCosignProvider({
        tenantId: TENANT_A,
        actorStaffId: "staff_a",
        credentials: { email: "doctor.a@test.dentaflow.io", password: "x" },
      }),
    ).rejects.toThrow(AnaesthesiaCosignError);
  });

  it("accepts a distinct provider in the same tenant", async () => {
    mockAuthFindUnique.mockResolvedValue({
      id: "auth_b",
      passwordHash: "hash",
    });
    mockCompare.mockResolvedValue(true);
    mockStaffFindFirst
      .mockResolvedValueOnce({
        id: "staff_b",
        role: UserRole.DOCTOR,
        authUserId: "auth_b",
      })
      .mockResolvedValueOnce({ authUserId: "auth_a" });

    const result = await authenticateCosignProvider({
      tenantId: TENANT_A,
      actorStaffId: "staff_a",
      credentials: { email: "doctor.b@test.dentaflow.io", password: "x" },
    });
    expect(result.staffId).toBe("staff_b");
  });
});

describe("anaesthesia line completion precondition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateLineAudited.mockReset();
    mockCreateAuditLog.mockReset();
    mockLineFindFirst.mockReset();
    mockAuthFindUnique.mockReset();
    mockCompare.mockReset();
    mockStaffFindFirst.mockReset();
    mockUpdateLineAudited.mockResolvedValue({ id: "line_1", status: "completed" });
    mockCreateAuditLog.mockResolvedValue({});
  });

  it("blocks completing an ANAESTHESIA line without a co-sign", async () => {
    mockLineFindFirst.mockResolvedValue({
      id: "line_1",
      tenantId: TENANT_A,
      encounterId: ENCOUNTER_A,
      status: "in_progress",
      startedAt: new Date(),
      encounter: { deletedAt: null, closedAt: null },
      procedureCatalog: { category: "ANAESTHESIA" },
    });

    await expect(
      transitionProcedureLineStatus({
        tenantId: TENANT_A,
        lineId: "line_1",
        toStatus: "completed",
        providerId: "staff_a",
        userId: "staff_a",
      }),
    ).rejects.toThrow(/No second provider is available/);
    expect(mockUpdateLineAudited).not.toHaveBeenCalled();
  });

  it("completes an ANAESTHESIA line when two distinct providers co-sign", async () => {
    mockLineFindFirst.mockResolvedValue({
      id: "line_1",
      tenantId: TENANT_A,
      encounterId: ENCOUNTER_A,
      status: "in_progress",
      startedAt: new Date(),
      encounter: { deletedAt: null, closedAt: null },
      procedureCatalog: { category: "ANAESTHESIA" },
    });
    mockAuthFindUnique.mockResolvedValue({
      id: "auth_b",
      passwordHash: "hash",
    });
    mockCompare.mockResolvedValue(true);
    mockStaffFindFirst
      .mockResolvedValueOnce({
        id: "staff_b",
        role: UserRole.DOCTOR,
        authUserId: "auth_b",
      })
      .mockResolvedValueOnce({ authUserId: "auth_a" });

    await transitionProcedureLineStatus({
      tenantId: TENANT_A,
      lineId: "line_1",
      toStatus: "completed",
      providerId: "staff_a",
      userId: "staff_a",
      cosign: { email: "doctor.b@test.dentaflow.io", password: "secret" },
    });

    expect(mockUpdateLineAudited).toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "EncounterProcedureLine",
        metadata: expect.objectContaining({
          kind: "anaesthesia_cosign",
          actorStaffId: "staff_a",
          cosignStaffId: "staff_b",
        }),
      }),
    );
  });

  it("still completes a non-anaesthesia line without co-sign", async () => {
    mockLineFindFirst.mockResolvedValue({
      id: "line_2",
      tenantId: TENANT_A,
      encounterId: ENCOUNTER_A,
      status: "in_progress",
      startedAt: new Date(),
      encounter: { deletedAt: null, closedAt: null },
      procedureCatalog: { category: "RESTORATIVE" },
    });

    await transitionProcedureLineStatus({
      tenantId: TENANT_A,
      lineId: "line_2",
      toStatus: "completed",
      providerId: "staff_a",
      userId: "staff_a",
    });
    expect(mockUpdateLineAudited).toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });
});
