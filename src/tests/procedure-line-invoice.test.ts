import { describe, it, expect } from "vitest";
import { UserRole } from "@prisma/client";
import { calculateIndiaGstInvoice } from "@/lib/billing/india-gst";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { getNavItemsForRole } from "@/lib/rbac/navigation";
import {
  aggregateProcedureLineTotal,
  assertProcedureLineModifiable,
  buildVisitInvoiceNotes,
  classifyAppointmentForBillingQueue,
  countDistinctVisitInvoices,
  extractProcedureCodesFromInvoiceItems,
  getAgingBucket,
  mapProcedureLinesToInvoiceItems,
  selectBillableProcedureLines,
  type ProcedureLineBillable,
} from "@/lib/billing/procedure-line-invoice";

const doctorLine = (
  id: string,
  overrides: Partial<ProcedureLineBillable> = {},
): ProcedureLineBillable => ({
  id,
  ownerType: "DOCTOR",
  ownerId: "doc-1",
  ownerName: "Dr. Smith",
  status: "CLOSED",
  procedureCode: "D1110",
  procedureName: "Prophylaxis",
  unitPrice: 200,
  quantity: 1,
  lockedAt: null,
  lockedInvoiceId: null,
  ...overrides,
});

const storeLine = (
  id: string,
  overrides: Partial<ProcedureLineBillable> = {},
): ProcedureLineBillable => ({
  id,
  ownerType: "STORE",
  ownerId: null,
  status: "CLOSED",
  procedureCode: null,
  procedureName: "Whitening kit",
  unitPrice: 150,
  quantity: 2,
  lockedAt: null,
  lockedInvoiceId: null,
  itemType: "GOOD",
  gstRatePercent: 18,
  hsnCode: "3306",
  ...overrides,
});

describe("procedure-line invoice aggregation", () => {
  it("aggregates 2 doctor lines + 1 store line into one invoice total", () => {
    const lines = [
      doctorLine("d1", { procedureName: "Crown prep", unitPrice: 500 }),
      doctorLine("d2", { procedureName: "Consultation", unitPrice: 100, procedureCode: "D9310" }),
      storeLine("s1"),
    ];

    const items = mapProcedureLinesToInvoiceItems(lines);
    expect(items).toHaveLength(3);
    expect(items[0].itemType).toBe("SERVICE");
    expect(items[2].itemType).toBe("GOOD");
    expect(aggregateProcedureLineTotal(lines)).toBe(500 + 100 + 300);
    expect(items.reduce((sum, item) => sum + item.total, 0)).toBe(900);
  });

  it("selects only CLOSED unbilled lines and supports interim linesOnly", () => {
    const lines = [
      doctorLine("d1"),
      doctorLine("d2", { status: "IN_PROGRESS" }),
      doctorLine("d3", { status: "LOCKED", lockedAt: new Date().toISOString() }),
      storeLine("s1"),
    ];

    const allBillable = selectBillableProcedureLines(lines);
    expect(allBillable.map((l) => l.id)).toEqual(["d1", "s1"]);

    const interimOnly = selectBillableProcedureLines(lines, ["d1"]);
    expect(interimOnly.map((l) => l.id)).toEqual(["d1"]);
  });

  it("classifies ready vs interim queue sections", () => {
    const closedUnbilled = [
      { status: "CLOSED", lockedAt: null, lockedInvoiceId: null },
      { status: "IN_PROGRESS", lockedAt: null, lockedInvoiceId: null },
    ];

    expect(classifyAppointmentForBillingQueue("COMPLETED", closedUnbilled).section).toBe(
      "ready",
    );
    expect(classifyAppointmentForBillingQueue("IN_CHAIR", closedUnbilled).section).toBe(
      "interim",
    );
    expect(
      classifyAppointmentForBillingQueue("IN_CHAIR", [
        { status: "IN_PROGRESS", lockedAt: null, lockedInvoiceId: null },
      ]).section,
    ).toBeNull();
  });

  it("labels visit invoices for interim and follow-up billing", () => {
    expect(
      buildVisitInvoiceNotes({
        appointmentId: "apt-1",
        appointmentRef: "APT-42",
        visitInvoiceNumber: 1,
        isInterim: true,
      }),
    ).toContain("Invoice 1 of visit APT-42");
    expect(
      buildVisitInvoiceNotes({
        appointmentId: "apt-1",
        visitInvoiceNumber: 2,
        isInterim: false,
      }),
    ).toBe("Invoice 2 of visit apt-1");
  });

  it("counts distinct visit invoices from locked line references", () => {
    expect(countDistinctVisitInvoices(["inv-1", "inv-1", "inv-2", null])).toBe(2);
  });
});

describe("procedure-line locking", () => {
  it("rejects modifications to locked procedure lines", () => {
    expect(() =>
      assertProcedureLineModifiable({ status: "LOCKED", lockedAt: new Date() }),
    ).toThrow(/locked after billing/i);
    expect(() =>
      assertProcedureLineModifiable({ status: "CLOSED", lockedAt: null }),
    ).not.toThrow();
  });

  it("keeps remaining IN_PROGRESS lines available after interim selection", () => {
    const lines = [
      doctorLine("closed-1"),
      doctorLine("open-1", { status: "IN_PROGRESS" }),
    ];
    const interim = selectBillableProcedureLines(lines, ["closed-1"]);
    expect(interim).toHaveLength(1);
    expect(classifyAppointmentForBillingQueue("IN_CHAIR", lines).section).toBe("interim");
    expect(classifyAppointmentForBillingQueue("IN_CHAIR", lines).hasUnbilledClosed).toBe(true);
    const afterInterim = [doctorLine("closed-1", { lockedAt: new Date().toISOString(), status: "LOCKED", lockedInvoiceId: "inv-1" })];
    expect(classifyAppointmentForBillingQueue("IN_CHAIR", afterInterim).section).toBeNull();
  });
});

describe("India GST on aggregated procedure-line items", () => {
  it("splits exempt services and taxable store goods on one invoice", () => {
    const items = mapProcedureLinesToInvoiceItems([
      doctorLine("d1", { procedureCode: "D1110", procedureName: "Cleaning", unitPrice: 1500 }),
      storeLine("s1", { unitPrice: 800, quantity: 1, gstRatePercent: 18, hsnCode: "8509" }),
    ]);

    const result = calculateIndiaGstInvoice(items, {
      clinicGstState: "27",
      patientStateCode: "27",
    });

    expect(result.exemptSubtotal).toBe(1500);
    expect(result.taxableSubtotal).toBe(800);
    expect(result.cgstTotal).toBe(72);
    expect(result.sgstTotal).toBe(72);
    expect(result.total).toBe(2444);
  });
});

describe("claim auto-suggest procedure code extraction", () => {
  it("collects procedure codes from mapped invoice items for insurance split", () => {
    const codes = extractProcedureCodesFromInvoiceItems(
      mapProcedureLinesToInvoiceItems([
        doctorLine("d1", { procedureCode: "D2740" }),
        storeLine("s1", { procedureCode: null }),
        doctorLine("d2", { procedureCode: "D9310" }),
      ]),
    );
    expect(codes).toEqual(["D2740", "D9310"]);
  });
});

describe("billing queue RBAC", () => {
  it("allows billing write for finance and admin roles", () => {
    expect(hasPermission(UserRole.FINANCE, PERMISSIONS.billing.write)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.billing.write)).toBe(true);
    expect(hasPermission(UserRole.OWNER, PERMISSIONS.billing.write)).toBe(true);
  });

  it("denies billing write for clinical roles without finance access", () => {
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.billing.write)).toBe(false);
    expect(hasPermission(UserRole.NURSE, PERMISSIONS.billing.write)).toBe(false);
    expect(hasPermission(UserRole.RECEPTIONIST, PERMISSIONS.billing.write)).toBe(false);
  });

  it("exposes ready-to-invoice nav for billing readers", () => {
    const financeNav = getNavItemsForRole(UserRole.FINANCE);
    const doctorNav = getNavItemsForRole(UserRole.DOCTOR);

    expect(financeNav.some((item) => item.href === "/billing/ready-to-invoice")).toBe(true);
    expect(doctorNav.some((item) => item.href === "/billing/ready-to-invoice")).toBe(true);
    expect(hasPermission(UserRole.DOCTOR, PERMISSIONS.billing.read)).toBe(true);
  });

  it("buckets aging for completed visits", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    expect(getAgingBucket(new Date("2026-07-10T08:00:00Z"), now)).toBe("0-24h");
    expect(getAgingBucket(new Date("2026-07-08T12:00:00Z"), now)).toBe("1-3d");
    expect(getAgingBucket(new Date("2026-07-01T12:00:00Z"), now)).toBe("3d+");
  });
});
