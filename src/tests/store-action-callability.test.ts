/**
 * Item #27 STORE action-level callability after the PHI lockdown.
 * Visible-in-UI vs callable-if-invoked are different questions — these invoke
 * the real server actions under a mocked TenantContext.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PaymentMethod,
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import type { TenantContext } from "@/lib/tenant/context";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mockRequireTenantContext = vi.hoisted(() => vi.fn());
const mockPatientFindMany = vi.hoisted(() => vi.fn());
const mockPatientFindFirst = vi.hoisted(() => vi.fn());
const mockInvoiceFindMany = vi.hoisted(() => vi.fn());
const mockInvoiceFindFirst = vi.hoisted(() => vi.fn());
const mockAppointmentFindMany = vi.hoisted(() => vi.fn());
const mockAppointmentUpdate = vi.hoisted(() => vi.fn());
const mockBarcodeScanCreate = vi.hoisted(() => vi.fn());

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
    patient: {
      findMany: (...a: unknown[]) => mockPatientFindMany(...a),
      findFirst: (...a: unknown[]) => mockPatientFindFirst(...a),
    },
    invoice: {
      findMany: (...a: unknown[]) => mockInvoiceFindMany(...a),
      findFirst: (...a: unknown[]) => mockInvoiceFindFirst(...a),
      update: vi.fn(),
    },
    appointment: {
      findMany: (...a: unknown[]) => mockAppointmentFindMany(...a),
      findFirst: vi.fn(),
      update: (...a: unknown[]) => mockAppointmentUpdate(...a),
    },
    barcodeScan: { create: (...a: unknown[]) => mockBarcodeScanCreate(...a) },
    payment: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    procedureCatalog: { findMany: vi.fn().mockResolvedValue([]) },
    chair: { findMany: vi.fn().mockResolvedValue([]) },
    doctor: { findMany: vi.fn().mockResolvedValue([]) },
    staffMember: { findMany: vi.fn().mockResolvedValue([]) },
    inventoryItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    stockTransaction: { create: vi.fn() },
  },
}));

vi.mock("@/lib/notifications/invoice-notifications", () => ({
  notifyInvoicePaid: vi.fn(),
  sendInvoiceEmailToPatient: vi.fn(),
  sendPaymentReceiptEmailToPatient: vi.fn(),
}));

vi.mock("@/lib/notifications/notification-service", () => ({
  notifyAppointmentStatus: vi.fn(),
}));

vi.mock("@/lib/insurance/maybe-create-draft-claim", () => ({
  maybeCreateDraftClaimForInvoice: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: vi.fn(),
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

describe("STORE PHI getters/mutations — action-level isolation", () => {
  let getPatients: typeof import("@/app/(dashboard)/features/patients/actions").getPatients;
  let getAppointments: typeof import("@/app/(dashboard)/features/appointments/actions").getAppointments;
  let getInvoices: typeof import("@/app/(dashboard)/features/billing/actions").getInvoices;
  let getProcedureCatalog: typeof import("@/app/(dashboard)/features/billing/actions").getProcedureCatalog;
  let recordPayment: typeof import("@/app/(dashboard)/features/billing/actions").recordPayment;
  let markInvoiceSent: typeof import("@/app/(dashboard)/features/billing/actions").markInvoiceSent;
  let updateAppointmentStatus: typeof import("@/app/(dashboard)/features/appointments/actions").updateAppointmentStatus;
  let beginChairsideVisit: typeof import("@/app/(dashboard)/features/clinical/chairside-actions").beginChairsideVisit;
  let getPatientPhotos: typeof import("@/app/(dashboard)/features/clinical/photo-actions").getPatientPhotos;
  let lookupByBarcode: typeof import("@/app/(dashboard)/features/patients/barcode-actions").lookupByBarcode;
  let checkinByBarcode: typeof import("@/app/(dashboard)/features/patients/barcode-actions").checkinByBarcode;
  let addStock: typeof import("@/app/(dashboard)/features/inventory/actions").addStock;

  beforeAll(async () => {
    getPatients = (await import("@/app/(dashboard)/features/patients/actions")).getPatients;
    const appt = await import("@/app/(dashboard)/features/appointments/actions");
    getAppointments = appt.getAppointments;
    updateAppointmentStatus = appt.updateAppointmentStatus;
    const billing = await import("@/app/(dashboard)/features/billing/actions");
    getInvoices = billing.getInvoices;
    getProcedureCatalog = billing.getProcedureCatalog;
    recordPayment = billing.recordPayment;
    markInvoiceSent = billing.markInvoiceSent;
    beginChairsideVisit = (await import("@/app/(dashboard)/features/clinical/chairside-actions"))
      .beginChairsideVisit;
    getPatientPhotos = (await import("@/app/(dashboard)/features/clinical/photo-actions"))
      .getPatientPhotos;
    const barcode = await import("@/app/(dashboard)/features/patients/barcode-actions");
    lookupByBarcode = barcode.lookupByBarcode;
    checkinByBarcode = barcode.checkinByBarcode;
    addStock = (await import("@/app/(dashboard)/features/inventory/actions")).addStock;
  }, 120_000);

  beforeEach(() => {
    mockRequireTenantContext.mockReset();
    mockPatientFindMany.mockReset();
    mockPatientFindFirst.mockReset();
    mockInvoiceFindMany.mockReset();
    mockInvoiceFindFirst.mockReset();
    mockAppointmentFindMany.mockReset();
    mockAppointmentUpdate.mockReset();
    mockBarcodeScanCreate.mockReset();
    mockPatientFindMany.mockResolvedValue([{ id: "pat_1", firstName: "Ada" }]);
    mockInvoiceFindMany.mockResolvedValue([{ id: "inv_1" }]);
    mockAppointmentFindMany.mockResolvedValue([{ id: "appt_1" }]);
    mockAppointmentUpdate.mockResolvedValue({
      id: "appt_1",
      patient: { firstName: "Ada", lastName: "Lovelace" },
    });
  });

  it("denies STORE PHI list getters", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.STORE, "store"));
    await expect(getPatients()).rejects.toThrow("FORBIDDEN");
    await expect(getAppointments()).rejects.toThrow("FORBIDDEN");
    await expect(getInvoices()).rejects.toThrow("FORBIDDEN");
    await expect(getProcedureCatalog()).rejects.toThrow("FORBIDDEN");
    expect(mockPatientFindMany).not.toHaveBeenCalled();
    expect(mockInvoiceFindMany).not.toHaveBeenCalled();
  });

  it("allows FINANCE getInvoices (billing.read control)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.FINANCE, "finance"));
    await expect(getInvoices()).resolves.toEqual([expect.objectContaining({ id: "inv_1" })]);
  });

  it("allows RECEPTIONIST getPatients and getInvoices (front-desk billing read)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.RECEPTIONIST, "front"));
    await expect(getPatients()).resolves.toEqual([expect.objectContaining({ id: "pat_1" })]);
    await expect(getInvoices()).resolves.toEqual([expect.objectContaining({ id: "inv_1" })]);
  });

  it("denies NURSE getInvoices (billing:none — live identical /billing was matrix over-grant, not a missing page gate)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.NURSE, "nurse"));
    await expect(getInvoices()).rejects.toThrow("FORBIDDEN");
    expect(mockInvoiceFindMany).not.toHaveBeenCalled();
  });

  it("RECEPTIONIST addStock is not callable (inventory.write gated — buttons were visible-only)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.RECEPTIONIST, "front"));
    await expect(
      addStock({ inventoryItemId: "item_1", quantity: 1 }),
    ).resolves.toMatchObject({ success: false, error: "You do not have permission" });
  });

  it("STORE recordPayment / markInvoiceSent / Check in remain non-callable", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.STORE, "store"));
    await expect(
      recordPayment({ invoiceId: "inv_1", amount: 10, method: PaymentMethod.CASH }),
    ).resolves.toMatchObject({ success: false, error: "You do not have permission" });
    await expect(markInvoiceSent({ invoiceId: "inv_1" })).resolves.toMatchObject({
      success: false,
      error: "You do not have permission",
    });
    await expect(updateAppointmentStatus({ id: "appt_1", status: "ARRIVED" })).resolves.toMatchObject({
      success: false,
      error: "You do not have permission",
    });
  });

  it("STORE clinical encounter/photo/chairside actions fail closed", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.STORE, "store"));
    await expect(beginChairsideVisit({ patientId: "pat_1", appointmentId: "appt_1" })).rejects.toThrow(
      /permission to start a chairside session/,
    );
    await expect(getPatientPhotos("pat_1")).rejects.toThrow("FORBIDDEN");
  });

  it("STORE lookupByBarcode / checkinByBarcode fail closed (Finding-1-class gap closed)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.STORE, "store"));
    await expect(lookupByBarcode("P-001")).rejects.toThrow("FORBIDDEN");
    await expect(checkinByBarcode("pat_1", "appt_1")).rejects.toThrow("FORBIDDEN");
    expect(mockAppointmentUpdate).not.toHaveBeenCalled();
  });

  it("patients/[id] catches clinical_schedule FORBIDDEN so the 360 page does not RSC-crash", () => {
    const src = readFileSync(
      resolve(__dirname, "../app/(dashboard)/patients/[id]/page.tsx"),
      "utf8",
    );
    expect(src).toContain("getPatientTreatmentPlanPreAuths");
    expect(src).toContain('error.message === "FORBIDDEN"');
  });

  it("dashboard error boundary turns FORBIDDEN into an access-denied page", () => {
    const src = readFileSync(
      resolve(__dirname, "../app/(dashboard)/error.tsx"),
      "utf8",
    );
    expect(src).toContain('error.message === "FORBIDDEN"');
    expect(src).toContain("You don’t have access to this page");
  });

  it("/billing and /reports pages do call requireRouteAccess (not an ungated route)", () => {
    const billing = readFileSync(
      resolve(__dirname, "../app/(dashboard)/billing/page.tsx"),
      "utf8",
    );
    const reports = readFileSync(
      resolve(__dirname, "../app/(dashboard)/reports/page.tsx"),
      "utf8",
    );
    expect(billing).toContain('requireRouteAccess("billing", "read")');
    expect(reports).toContain('requireRouteAccess("reports", "export")');
  });
});
