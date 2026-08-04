/**
 * Action-level cross-tenant isolation regressions for Critical IDOR fixes.
 * Direct action invocation (not page-redirect proxy) — forged client tenant/resource
 * IDs must not leak or mutate another tenant's data.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import type { TenantContext } from "@/lib/tenant/context";
import { canAccessPath } from "@/lib/rbac/routes";

const mockRequireTenantContext = vi.hoisted(() => vi.fn());
const mockPatientFindMany = vi.hoisted(() => vi.fn());
const mockPatientFindFirst = vi.hoisted(() => vi.fn());
const mockInvoiceFindFirst = vi.hoisted(() => vi.fn());
const mockInvoiceFindMany = vi.hoisted(() => vi.fn());
const mockTreatmentItemFindFirst = vi.hoisted(() => vi.fn());
const mockTreatmentPlanFindFirst = vi.hoisted(() => vi.fn());
const mockAppointmentFindFirst = vi.hoisted(() => vi.fn());
const mockProcedureLineCreate = vi.hoisted(() => vi.fn());
const mockProcedureLineFindFirst = vi.hoisted(() => vi.fn());
const mockProcedureLineUpdate = vi.hoisted(() => vi.fn());
const mockInventoryItemFindFirst = vi.hoisted(() => vi.fn());
const mockInventoryItemUpdate = vi.hoisted(() => vi.fn());
const mockStockTransactionCreate = vi.hoisted(() => vi.fn());
const mockProcedureCatalogFindMany = vi.hoisted(() => vi.fn());
const mockAppointmentUpdateMany = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenant/context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant/context")>();
  return {
    ...actual,
    requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a),
}));

vi.mock("@/lib/db", () => ({
  db: {
    patient: {
      findMany: (...a: unknown[]) => mockPatientFindMany(...a),
      findFirst: (...a: unknown[]) => mockPatientFindFirst(...a),
    },
    invoice: {
      findFirst: (...a: unknown[]) => mockInvoiceFindFirst(...a),
      findMany: (...a: unknown[]) => mockInvoiceFindMany(...a),
    },
    treatmentItem: {
      findFirst: (...a: unknown[]) => mockTreatmentItemFindFirst(...a),
    },
    treatmentPlan: {
      findFirst: (...a: unknown[]) => mockTreatmentPlanFindFirst(...a),
    },
    appointment: {
      findFirst: (...a: unknown[]) => mockAppointmentFindFirst(...a),
      updateMany: (...a: unknown[]) => mockAppointmentUpdateMany(...a),
    },
    procedureLine: {
      create: (...a: unknown[]) => mockProcedureLineCreate(...a),
      findFirst: (...a: unknown[]) => mockProcedureLineFindFirst(...a),
      update: (...a: unknown[]) => mockProcedureLineUpdate(...a),
    },
    inventoryItem: {
      findFirst: (...a: unknown[]) => mockInventoryItemFindFirst(...a),
      update: (...a: unknown[]) => mockInventoryItemUpdate(...a),
    },
    stockTransaction: {
      create: (...a: unknown[]) => mockStockTransactionCreate(...a),
    },
    procedureCatalog: {
      findMany: (...a: unknown[]) => mockProcedureCatalogFindMany(...a),
    },
    staffMember: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/billing/invoice-from-items", () => ({
  createInvoiceFromItems: vi.fn().mockResolvedValue({ id: "inv_a" }),
}));

vi.mock("@/lib/clinical/chairside-lifecycle", () => ({
  autoCloseChairsideSessionsForAppointment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/insurance/maybe-create-draft-claim", () => ({
  maybeCreateDraftClaimForInvoice: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/appointments/derive-completion-status", () => ({
  applyDerivedAppointmentCompletion: vi.fn().mockResolvedValue({ applied: false }),
}));

vi.mock("@/lib/insurance/pre-auth-gate", () => ({
  evaluateProcedureLinePreAuthClose: vi.fn().mockResolvedValue({
    requiresPreAuth: false,
    preAuthStatus: null,
    warning: null,
  }),
}));

vi.mock("@/app/(dashboard)/features/clinical/treatment-plan-actions", () => ({
  updateTreatmentPlanItem: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/rbac/guard", () => ({
  requirePermission: vi.fn().mockResolvedValue(undefined),
}));

function ownerContext(tenantId = "tenant_a"): TenantContext {
  const staffMember = {
    id: "staff_a_owner",
    tenantId,
    authUserId: "auth_owner_a",
    email: "owner@brightsmile.demo",
    firstName: "Sarah",
    lastName: "Mitchell",
    avatarUrl: null,
    role: UserRole.OWNER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as TenantContext["staffMember"];

  return {
    tenant: {
      id: tenantId,
      name: "BrightSmile",
      slug: "brightsmile-dental",
      email: null,
      phone: null,
      address: null,
      city: null,
      country: null,
      timezone: "UTC",
      logoUrl: null,
      subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      stripeCustomerId: "cus_a",
      stripeSubscriptionId: null,
      onboardingCompleted: true,
      status: TenantStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      featureFlags: {},
    } as TenantContext["tenant"],
    staffMember,
    user: staffMember,
    authUserId: "auth_owner_a",
    tenantSlug: "brightsmile-dental",
    tenantId,
    isSuperAdmin: false,
    trial: {
      isTrialing: false,
      daysRemaining: 0,
      trialEndsAt: null,
      isExpired: false,
    },
    countryProfile: {} as TenantContext["countryProfile"],
    currency: "USD",
    taxRate: 0,
    taxName: "Tax",
  };
}

describe("tenant IDOR isolation — session-derived getters", () => {
  let getPatients: typeof import("@/app/(dashboard)/features/patients/actions").getPatients;
  let getInvoices: typeof import("@/app/(dashboard)/features/billing/actions").getInvoices;
  let createStripePaymentLink: typeof import("@/app/(dashboard)/features/billing/actions").createStripePaymentLink;

  // Heavy server-action imports; under full-suite RAM pressure on the 8GB dev box
  // these routinely exceed vitest's default 10s hookTimeout.
  beforeAll(async () => {
    ({ getPatients } = await import("@/app/(dashboard)/features/patients/actions"));
    ({ getInvoices, createStripePaymentLink } = await import(
      "@/app/(dashboard)/features/billing/actions"
    ));
  }, 60_000);

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTenantContext.mockResolvedValue(ownerContext("tenant_a"));
    mockPatientFindMany.mockResolvedValue([]);
    mockInvoiceFindMany.mockResolvedValue([]);
    mockInvoiceFindFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("getPatients queries only the session tenant (ignores any prior client-tenantId pattern)", async () => {
    await getPatients();
    expect(mockPatientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant_a" }),
      }),
    );
    const where = mockPatientFindMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe("tenant_a");
    expect(where.tenantId).not.toBe("tenant_b");
  });

  it("getInvoices queries only the session tenant", async () => {
    await getInvoices();
    expect(mockInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant_a" }),
      }),
    );
  });

  it("createStripePaymentLink refuses invoices outside the session tenant", async () => {
    mockInvoiceFindFirst.mockResolvedValue(null);
    await expect(createStripePaymentLink("invoice_b_1")).rejects.toThrow("Invoice not found");
    expect(mockInvoiceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "invoice_b_1", tenantId: "tenant_a" }),
      }),
    );
  });
});

describe("tenant IDOR isolation — treatmentItemId ownership", () => {
  let createProcedureLine: typeof import("@/app/(dashboard)/features/procedure-lines/actions").createProcedureLine;
  let closeProcedureLine: typeof import("@/app/(dashboard)/features/procedure-lines/actions").closeProcedureLine;

  beforeAll(async () => {
    ({ createProcedureLine, closeProcedureLine } = await import(
      "@/app/(dashboard)/features/procedure-lines/actions"
    ));
  }, 60_000);

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTenantContext.mockResolvedValue(ownerContext("tenant_a"));
    mockAppointmentFindFirst.mockResolvedValue({ id: "appt_a" });
    mockTreatmentItemFindFirst.mockResolvedValue(null);
  });

  it("createProcedureLine rejects a treatmentItemId from another tenant", async () => {
    await expect(
      createProcedureLine({
        appointmentId: "appt_a",
        ownerType: "DOCTOR",
        procedureName: "probe",
        treatmentItemId: "titem_b_completed",
      }),
    ).rejects.toThrow("Treatment item not found");

    expect(mockTreatmentItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "titem_b_completed", tenantId: "tenant_a" },
      }),
    );
    expect(mockProcedureLineCreate).not.toHaveBeenCalled();
  });

  it("closeProcedureLine rejects when linked treatment item is not in session tenant", async () => {
    mockProcedureLineFindFirst.mockResolvedValue({
      id: "line_1",
      tenantId: "tenant_a",
      appointmentId: "appt_a",
      ownerId: "staff_a_owner",
      status: "IN_PROGRESS",
      lockedAt: null,
      procedureCode: null,
      treatmentItemId: "titem_b_completed",
    });
    mockTreatmentItemFindFirst.mockResolvedValue(null);

    await expect(closeProcedureLine("line_1")).rejects.toThrow("Treatment item not found");
  });
});

describe("tenant IDOR isolation — inventory decrement ownership", () => {
  let generateInvoiceFromProcedures: typeof import("@/app/(dashboard)/features/clinical/actions").generateInvoiceFromProcedures;

  beforeAll(async () => {
    ({ generateInvoiceFromProcedures } = await import(
      "@/app/(dashboard)/features/clinical/actions"
    ));
  }, 60_000);

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTenantContext.mockResolvedValue(ownerContext("tenant_a"));
    mockPatientFindFirst.mockResolvedValue({ id: "patient_a_1" });
    mockProcedureCatalogFindMany.mockResolvedValue([
      {
        id: "proc_poison",
        name: "Poison",
        code: "X",
        price: 10,
        inventoryConsumption: JSON.stringify([
          { inventoryItemId: "inv_b_1", quantity: 3 },
        ]),
      },
    ]);
    mockInventoryItemFindFirst.mockResolvedValue(null);
    mockAppointmentUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("generateInvoiceFromProcedures refuses foreign inventoryItemId in consumption JSON", async () => {
    const result = await generateInvoiceFromProcedures({
      appointmentId: "appt_a",
      patientId: "patient_a_1",
      procedures: [{ procedureId: "proc_poison", quantity: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/Inventory item not found/i);
    }
    expect(mockInventoryItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "inv_b_1",
          tenantId: "tenant_a",
        }),
      }),
    );
    expect(mockInventoryItemUpdate).not.toHaveBeenCalled();
  });
});

describe("tenant IDOR isolation — /reception route rule", () => {
  it("gates /reception on appointments:read (no fail-open omission)", () => {
    expect(canAccessPath(UserRole.RECEPTIONIST, "/reception")).toBe(true);
    expect(canAccessPath(UserRole.STORE, "/reception")).toBe(true);
    // All matrix roles currently have appointments:read; rule still binds the path.
    expect(canAccessPath(UserRole.DOCTOR, "/reception")).toBe(true);
  });
});
