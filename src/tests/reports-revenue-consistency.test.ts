import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatCurrency } from "@/lib/countries";
import {
  billedInvoiceWhere,
  BILLED_INVOICE_STATUS,
  findSameDayPatientInvoice,
  reportRangeBounds,
  roundMoney,
} from "@/lib/reports/revenue";

describe("billed revenue semantics", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it("includes DRAFT and excludes VOID via shared status filter", () => {
    expect(BILLED_INVOICE_STATUS).toEqual({ not: "VOID" });
    const where = billedInvoiceWhere("ten_1", new Date("2026-07-18"), new Date("2026-08-18"));
    expect(where.tenantId).toBe("ten_1");
    expect(where.deletedAt).toBeNull();
    expect(where.status).toEqual({ not: "VOID" });
    expect(where.createdAt).toEqual({
      gte: new Date("2026-07-18"),
      lte: new Date("2026-08-18"),
    });
  });

  it("uses the same rolling month window for dashboard and reports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 18, 12, 0, 0));
    const { start, end } = reportRangeBounds("month");
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(18);
    expect(end.getMonth()).toBe(7);
    expect(end.getDate()).toBe(18);
  });

  it("attributes same-patient same-day DRAFT invoices (Kensington-shaped)", () => {
    const invoices = [
      { id: "inv18", patientId: "p-pearl", createdAt: new Date("2026-07-22T18:00:00"), total: 144 },
      { id: "inv19", patientId: "p-ava", createdAt: new Date("2026-07-23T10:00:00"), total: 429 },
      { id: "inv20", patientId: "p-no-appt", createdAt: new Date("2026-07-23T11:00:00"), total: 147 },
      { id: "inv21", patientId: "p-harry", createdAt: new Date("2026-07-23T12:00:00"), total: 149 },
      { id: "inv22", patientId: "p-pearl", createdAt: new Date("2026-07-23T15:00:00"), total: 88 },
      { id: "inv23", patientId: "p-ava", createdAt: new Date("2026-07-29T19:00:00"), total: 275 },
      { id: "inv24", patientId: "p-omar", createdAt: new Date("2026-07-30T08:00:00"), total: 168 },
      { id: "inv25", patientId: "p-aug", createdAt: new Date("2026-08-18T08:00:00"), total: 168 },
    ];
    const appointments = [
      { patientId: "p-pearl", startTime: new Date("2026-07-22T18:40:00") },
      { patientId: "p-ava", startTime: new Date("2026-07-23T08:00:00") },
      { patientId: "p-harry", startTime: new Date("2026-07-23T11:20:00") },
      { patientId: "p-pearl", startTime: new Date("2026-07-23T14:40:00") },
      { patientId: "p-ava", startTime: new Date("2026-07-29T19:20:00") },
      { patientId: "p-omar", startTime: new Date("2026-07-30T08:40:00") },
      { patientId: "p-aug", startTime: new Date("2026-08-18T08:00:00") },
    ];

    const billedTotal = roundMoney(invoices.reduce((s, i) => s + i.total, 0));
    expect(billedTotal).toBe(1568);

    const attributed = new Set<string>();
    let doctorRevenue = 0;
    for (const appt of appointments) {
      const match = findSameDayPatientInvoice(invoices, appt, attributed);
      if (match) {
        attributed.add(match.id);
        doctorRevenue += match.total;
      }
    }
    expect(roundMoney(doctorRevenue)).toBe(1421);
    expect(attributed.has("inv20")).toBe(false);
  });
});

describe("dashboard + reports query wiring", () => {
  it("dashboard KPI sums billed invoices, not payments", () => {
    const src = readFileSync(
      resolve("src/app/(dashboard)/features/dashboard/queries.ts"),
      "utf8",
    );
    expect(src).toContain("billedInvoiceWhere");
    expect(src).toContain("reportRangeBounds(\"month\")");
    expect(src).toContain("db.invoice.aggregate");
    expect(src).toContain("_sum: { total: true }");
    expect(src).not.toContain("db.payment.aggregate");
  });

  it("doctor productivity fallback uses billed invoices (includes DRAFT)", () => {
    const src = readFileSync(
      resolve("src/app/(dashboard)/features/reports/queries.ts"),
      "utf8",
    );
    expect(src).toContain("billedInvoiceWhere(tenantId, start, end)");
    expect(src).toContain("findSameDayPatientInvoice");
    expect(src).not.toMatch(/status:\s*\{\s*in:\s*\["PAID",\s*"PARTIAL",\s*"SENT"\]/);
  });

  it("tax and procedure reports share billedInvoiceWhere / parent where", () => {
    const src = readFileSync(
      resolve("src/app/(dashboard)/features/reports/queries.ts"),
      "utf8",
    );
    expect(src).toContain("billedInvoiceWhere(tenantId, start, end)");
    expect(src).toContain("billedInvoiceParentWhere(start, end)");
  });
});

describe("tenant currency on dashboard vs reports", () => {
  it("formats GB amounts with £ and not $", () => {
    const formatted = formatCurrency(1568, "GB");
    expect(formatted).toContain("£");
    expect(formatted).toContain("1,568.00");
    expect(formatted).not.toContain("$");
  });

  it("DashboardClient formats revenue with tenant countryCode", () => {
    const src = readFileSync(
      resolve("src/app/(dashboard)/dashboard/dashboard-client.tsx"),
      "utf8",
    );
    expect(src).toContain('import { formatCurrency } from "@/lib/countries"');
    expect(src).toContain("formatCurrency(kpis.revenueThisMonth, countryCode)");
    expect(src).not.toContain('from "@/lib/utils"');
    expect(src).not.toContain("Collected payments");
    expect(src).not.toMatch(/currency:\s*"USD"/);
  });

  it("Finance dashboard StatCard does not hardcode USD", () => {
    const src = readFileSync(
      resolve("src/components/dashboard/role-dashboards/role-dashboard-homes.tsx"),
      "utf8",
    );
    expect(src).toContain('import { formatCurrency } from "@/lib/countries"');
    expect(src).not.toMatch(/currency:\s*"USD"/);
    expect(src).toContain("countryCode");
  });

  it("Reports overview labels billed revenue", () => {
    const src = readFileSync(
      resolve("src/app/(dashboard)/reports/reports-client.tsx"),
      "utf8",
    );
    expect(src).toContain("Billed revenue (MTD)");
    expect(src).toContain("Billed total");
    expect(src).toContain('import { formatCurrency } from "@/lib/countries"');
  });
});
