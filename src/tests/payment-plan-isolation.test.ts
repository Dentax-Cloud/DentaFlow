/**
 * Action-level billing.write isolation for payment-plan mutations.
 * Same mocked-TenantContext pattern as front-office-insurance-action-isolation.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import type { TenantContext } from "@/lib/tenant/context";

const mockRequireTenantContext = vi.hoisted(() => vi.fn());
const mockPatientFindFirst = vi.hoisted(() => vi.fn());
const mockPaymentPlanCreate = vi.hoisted(() => vi.fn());
const mockInvoiceUpdate = vi.hoisted(() => vi.fn());
const mockInstallmentFindFirst = vi.hoisted(() => vi.fn());
const mockInstallmentUpdate = vi.hoisted(() => vi.fn());
const mockPaymentPlanUpdate = vi.hoisted(() => vi.fn());

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
    patient: { findFirst: (...a: unknown[]) => mockPatientFindFirst(...a) },
    paymentPlan: {
      create: (...a: unknown[]) => mockPaymentPlanCreate(...a),
      update: (...a: unknown[]) => mockPaymentPlanUpdate(...a),
    },
    paymentPlanInstallment: {
      findFirst: (...a: unknown[]) => mockInstallmentFindFirst(...a),
      update: (...a: unknown[]) => mockInstallmentUpdate(...a),
    },
    invoice: { update: (...a: unknown[]) => mockInvoiceUpdate(...a) },
  },
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

const createInput = {
  patientId: "pat_1",
  totalAmount: 1000,
  installments: 4,
  startDate: "2026-08-16",
};

describe("payment-plan actions — billing.write isolation", () => {
  let createPaymentPlan: typeof import("@/app/(dashboard)/features/billing/payment-plan-actions").createPaymentPlan;
  let recordInstallmentPayment: typeof import("@/app/(dashboard)/features/billing/payment-plan-actions").recordInstallmentPayment;

  beforeAll(async () => {
    const mod = await import("@/app/(dashboard)/features/billing/payment-plan-actions");
    createPaymentPlan = mod.createPaymentPlan;
    recordInstallmentPayment = mod.recordInstallmentPayment;
  }, 60_000);

  beforeEach(() => {
    mockRequireTenantContext.mockReset();
    mockPatientFindFirst.mockReset();
    mockPaymentPlanCreate.mockReset();
    mockInvoiceUpdate.mockReset();
    mockInstallmentFindFirst.mockReset();
    mockInstallmentUpdate.mockReset();
    mockPaymentPlanUpdate.mockReset();

    mockPatientFindFirst.mockResolvedValue({ id: "pat_1", tenantId: "tenant_test" });
    mockPaymentPlanCreate.mockResolvedValue({
      id: "plan_1",
      tenantId: "tenant_test",
      totalAmount: 1000,
      planInstallments: [],
    });
    mockInstallmentFindFirst.mockResolvedValue({
      id: "inst_1",
      planId: "plan_1",
      amount: 250,
      paidAmount: 0,
      plan: { tenantId: "tenant_test", paidAmount: 0, totalAmount: 1000 },
    });
    mockInstallmentUpdate.mockResolvedValue({});
    mockPaymentPlanUpdate.mockResolvedValue({});
  });

  it("denies createPaymentPlan for STORE (no billing.write)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.STORE, "store"));
    await expect(createPaymentPlan(createInput)).rejects.toThrow("FORBIDDEN");
    expect(mockPaymentPlanCreate).not.toHaveBeenCalled();
  });

  it("denies createPaymentPlan for NURSE (no billing.write)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.NURSE, "nurse"));
    await expect(createPaymentPlan(createInput)).rejects.toThrow("FORBIDDEN");
    expect(mockPaymentPlanCreate).not.toHaveBeenCalled();
  });

  it("allows createPaymentPlan for FINANCE (billing.write control)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.FINANCE, "finance"));
    const result = await createPaymentPlan(createInput);
    expect(mockPaymentPlanCreate).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: "plan_1" });
  });

  it("denies recordInstallmentPayment for STORE (no billing.write)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.STORE, "store"));
    await expect(
      recordInstallmentPayment({ installmentId: "inst_1", amount: 250 }),
    ).rejects.toThrow("FORBIDDEN");
    expect(mockInstallmentUpdate).not.toHaveBeenCalled();
  });

  it("allows recordInstallmentPayment for FINANCE (billing.write control)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.FINANCE, "finance"));
    const result = await recordInstallmentPayment({ installmentId: "inst_1", amount: 250 });
    expect(result).toEqual({ ok: true });
    expect(mockInstallmentUpdate).toHaveBeenCalledTimes(1);
  });
});
