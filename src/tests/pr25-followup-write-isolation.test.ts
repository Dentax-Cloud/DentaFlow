/**
 * PR #25 follow-up: action-level evidence for Mark sent / Record payment and
 * inventory Add/Issue/Remove. Real `requirePermission` (not mocked) under an
 * injected TenantContext. createAction maps FORBIDDEN →
 * `{ success: false, error: "You do not have permission" }`.
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
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";

const mockRequireTenantContext = vi.hoisted(() => vi.fn());
const mockInvoiceFindFirst = vi.hoisted(() => vi.fn());
const mockInvoiceFindMany = vi.hoisted(() => vi.fn());
const mockInvoiceUpdate = vi.hoisted(() => vi.fn());
const mockPaymentCreate = vi.hoisted(() => vi.fn());
const mockInventoryFindFirst = vi.hoisted(() => vi.fn());
const mockInventoryUpdate = vi.hoisted(() => vi.fn());
const mockStockCreate = vi.hoisted(() => vi.fn());
const mockAuditCreate = vi.hoisted(() => vi.fn());

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
    invoice: {
      findFirst: (...a: unknown[]) => mockInvoiceFindFirst(...a),
      findMany: (...a: unknown[]) => mockInvoiceFindMany(...a),
      update: (...a: unknown[]) => mockInvoiceUpdate(...a),
    },
    payment: { create: (...a: unknown[]) => mockPaymentCreate(...a) },
    inventoryItem: {
      findFirst: (...a: unknown[]) => mockInventoryFindFirst(...a),
      update: (...a: unknown[]) => mockInventoryUpdate(...a),
    },
    stockTransaction: { create: (...a: unknown[]) => mockStockCreate(...a) },
    auditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
    procedureCatalog: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/notifications/invoice-notifications", () => ({
  notifyInvoicePaid: vi.fn().mockResolvedValue(undefined),
  sendInvoiceEmailToPatient: vi.fn().mockResolvedValue(false),
  sendPaymentReceiptEmailToPatient: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/insurance/maybe-create-draft-claim", () => ({
  maybeCreateDraftClaimForInvoice: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: vi.fn(),
}));

vi.mock("@/lib/ids/generate-ids", () => ({
  generateStockRef: vi.fn().mockResolvedValue("STK-TEST-1"),
  generateInvoiceRef: vi.fn().mockResolvedValue("INV-TEST-1"),
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

const DENIED = { success: false, error: "You do not have permission" } as const;

describe("PR #25 follow-up — billing/inventory write isolation", () => {
  let markInvoiceSent: typeof import("@/app/(dashboard)/features/billing/actions").markInvoiceSent;
  let recordPayment: typeof import("@/app/(dashboard)/features/billing/actions").recordPayment;
  let getInvoices: typeof import("@/app/(dashboard)/features/billing/actions").getInvoices;
  let addStock: typeof import("@/app/(dashboard)/features/inventory/actions").addStock;
  let issueStock: typeof import("@/app/(dashboard)/features/inventory/actions").issueStock;
  let removeStock: typeof import("@/app/(dashboard)/features/inventory/actions").removeStock;

  beforeAll(async () => {
    const billing = await import("@/app/(dashboard)/features/billing/actions");
    markInvoiceSent = billing.markInvoiceSent;
    recordPayment = billing.recordPayment;
    getInvoices = billing.getInvoices;
    const inventory = await import("@/app/(dashboard)/features/inventory/actions");
    addStock = inventory.addStock;
    issueStock = inventory.issueStock;
    removeStock = inventory.removeStock;
  }, 120_000);

  beforeEach(() => {
    mockRequireTenantContext.mockReset();
    mockInvoiceFindFirst.mockReset();
    mockInvoiceFindMany.mockReset();
    mockInvoiceUpdate.mockReset();
    mockPaymentCreate.mockReset();
    mockInventoryFindFirst.mockReset();
    mockInventoryUpdate.mockReset();
    mockStockCreate.mockReset();
    mockAuditCreate.mockReset();

    mockInvoiceFindFirst.mockResolvedValue({
      id: "inv_1",
      tenantId: "tenant_test",
      total: 100,
      status: "DRAFT",
      payments: [],
      patientId: "pat_1",
      emailedAt: null,
    });
    mockInvoiceFindMany.mockResolvedValue([{ id: "inv_1", invoiceNumber: "INV-1" }]);
    mockInvoiceUpdate.mockResolvedValue({ id: "inv_1", status: "SENT" });
    mockPaymentCreate.mockResolvedValue({ id: "pay_1", amount: 10 });
    mockInventoryFindFirst.mockResolvedValue({
      id: "item_1",
      tenantId: "tenant_test",
      quantity: 10,
      deletedAt: null,
    });
    mockInventoryUpdate.mockResolvedValue({});
    mockStockCreate.mockResolvedValue({ id: "stx_1" });
    mockAuditCreate.mockResolvedValue({});
  });

  it("STORE Mark sent / Record payment are denied (billing.write already required)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.STORE, "store"));
    const sent = await markInvoiceSent({ invoiceId: "inv_1" });
    const pay = await recordPayment({
      invoiceId: "inv_1",
      amount: 10,
      method: PaymentMethod.CASH,
    });
    // Evidence for the PR report — actual ActionResult, not a matrix guess.
    // eslint-disable-next-line no-console
    console.log("[evidence] STORE markInvoiceSent", sent);
    // eslint-disable-next-line no-console
    console.log("[evidence] STORE recordPayment", pay);
    expect(sent).toMatchObject(DENIED);
    expect(pay).toMatchObject(DENIED);
    expect(mockInvoiceUpdate).not.toHaveBeenCalled();
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  it("NURSE Mark sent / Record payment are denied (billing.write already required)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.NURSE, "nurse"));
    const sent = await markInvoiceSent({ invoiceId: "inv_1" });
    const pay = await recordPayment({
      invoiceId: "inv_1",
      amount: 10,
      method: PaymentMethod.CASH,
    });
    // eslint-disable-next-line no-console
    console.log("[evidence] NURSE markInvoiceSent", sent);
    // eslint-disable-next-line no-console
    console.log("[evidence] NURSE recordPayment", pay);
    expect(sent).toMatchObject(DENIED);
    expect(pay).toMatchObject(DENIED);
    expect(mockInvoiceUpdate).not.toHaveBeenCalled();
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  it("RECEPTIONIST Add stock / Issue / Remove are denied (inventory.write already required)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.RECEPTIONIST, "front"));
    const add = await addStock({ inventoryItemId: "item_1", quantity: 1 });
    const issue = await issueStock({
      inventoryItemId: "item_1",
      quantity: 1,
      reason: "other",
      destinationType: "other",
      destinationLabel: "front desk",
    });
    const remove = await removeStock({ inventoryItemId: "item_1", quantity: 1 });
    // eslint-disable-next-line no-console
    console.log("[evidence] RECEPTIONIST addStock", add);
    // eslint-disable-next-line no-console
    console.log("[evidence] RECEPTIONIST issueStock", issue);
    // eslint-disable-next-line no-console
    console.log("[evidence] RECEPTIONIST removeStock", remove);
    expect(add).toMatchObject(DENIED);
    expect(issue).toMatchObject(DENIED);
    expect(remove).toMatchObject(DENIED);
    expect(mockInventoryUpdate).not.toHaveBeenCalled();
    expect(mockStockCreate).not.toHaveBeenCalled();
  });

  it("RECEPTIONIST can read invoices but cannot Mark sent / Record payment", async () => {
    expect(hasPermission(UserRole.RECEPTIONIST, PERMISSIONS.billing.read)).toBe(true);
    expect(hasPermission(UserRole.RECEPTIONIST, PERMISSIONS.billing.write)).toBe(false);
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.RECEPTIONIST, "front"));
    await expect(getInvoices()).resolves.toEqual([expect.objectContaining({ id: "inv_1" })]);
    await expect(markInvoiceSent({ invoiceId: "inv_1" })).resolves.toMatchObject(DENIED);
    await expect(
      recordPayment({ invoiceId: "inv_1", amount: 10, method: PaymentMethod.CASH }),
    ).resolves.toMatchObject(DENIED);
  });

  it("DOCTOR can read invoices but cannot Mark sent / Record payment", async () => {
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.billing.read)).toBe(true);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.billing.write)).toBe(false);
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.DOCTOR, "doc"));
    const invoices = await getInvoices();
    const sent = await markInvoiceSent({ invoiceId: "inv_1" });
    const pay = await recordPayment({
      invoiceId: "inv_1",
      amount: 10,
      method: PaymentMethod.CASH,
    });
    // eslint-disable-next-line no-console
    console.log("[evidence] DOCTOR getInvoices", invoices);
    // eslint-disable-next-line no-console
    console.log("[evidence] DOCTOR markInvoiceSent", sent);
    // eslint-disable-next-line no-console
    console.log("[evidence] DOCTOR recordPayment", pay);
    expect(invoices).toEqual([expect.objectContaining({ id: "inv_1" })]);
    expect(sent).toMatchObject(DENIED);
    expect(pay).toMatchObject(DENIED);
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  it("FINANCE Mark sent / Record payment succeed (billing.write control)", async () => {
    mockRequireTenantContext.mockResolvedValue(staffContext(UserRole.FINANCE, "finance"));
    const sent = await markInvoiceSent({ invoiceId: "inv_1" });
    const pay = await recordPayment({
      invoiceId: "inv_1",
      amount: 10,
      method: PaymentMethod.CASH,
    });
    // eslint-disable-next-line no-console
    console.log("[evidence] FINANCE markInvoiceSent", sent);
    // eslint-disable-next-line no-console
    console.log("[evidence] FINANCE recordPayment", pay);
    expect(sent.success).toBe(true);
    expect(pay.success).toBe(true);
    expect(mockInvoiceUpdate).toHaveBeenCalled();
    expect(mockPaymentCreate).toHaveBeenCalled();
  });
});
