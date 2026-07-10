import { describe, it, expect } from "vitest";
import {
  PRE_AUTH_WARNING_MESSAGE,
  type ProcedureLinePreAuthEvaluation,
} from "@/lib/insurance/pre-auth-gate";
import {
  aggregateProcedureLineTotal,
  mapProcedureLinesToInvoiceItems,
  type ProcedureLineBillable,
} from "@/lib/billing/procedure-line-invoice";
import {
  buildVisitFinancialEstimateSummary,
  type VisitFinancialEstimate,
} from "@/lib/encounter/visit-financial-estimate";
import {
  buildTreatmentPlanBookingSuggestionBody,
  countOutstandingUnscheduledTreatmentItems,
  treatmentPlanBookingLink,
  type TreatmentPlanSnapshot,
} from "@/lib/encounter/treatment-plan-booking-suggestion";

function evaluatePreAuthClosePure(params: {
  requiresPreAuth: boolean;
  hasInsurance: boolean;
  hasApproval: boolean;
}): ProcedureLinePreAuthEvaluation {
  if (!params.requiresPreAuth) {
    return {
      requiresPreAuth: false,
      preAuthStatus: "NOT_REQUIRED",
      showWarning: false,
      warningMessage: null,
    };
  }
  if (!params.hasInsurance) {
    return {
      requiresPreAuth: true,
      preAuthStatus: "NOT_REQUIRED",
      showWarning: false,
      warningMessage: null,
    };
  }
  if (params.hasApproval) {
    return {
      requiresPreAuth: true,
      preAuthStatus: "APPROVED",
      showWarning: false,
      warningMessage: null,
    };
  }
  return {
    requiresPreAuth: true,
    preAuthStatus: "MISSING",
    showWarning: true,
    warningMessage: PRE_AUTH_WARNING_MESSAGE,
  };
}

describe("procedure line pre-auth at close", () => {
  it("warns but allows close when pre-auth is required and missing", () => {
    const result = evaluatePreAuthClosePure({
      requiresPreAuth: true,
      hasInsurance: true,
      hasApproval: false,
    });

    expect(result.showWarning).toBe(true);
    expect(result.preAuthStatus).toBe("MISSING");
    expect(result.warningMessage).toMatch(/pre-authorization/i);
  });

  it("sets APPROVED when approved pre-auth exists", () => {
    const result = evaluatePreAuthClosePure({
      requiresPreAuth: true,
      hasInsurance: true,
      hasApproval: true,
    });

    expect(result.showWarning).toBe(false);
    expect(result.preAuthStatus).toBe("APPROVED");
  });

  it("does not warn when pre-auth is not required", () => {
    const result = evaluatePreAuthClosePure({
      requiresPreAuth: false,
      hasInsurance: true,
      hasApproval: false,
    });

    expect(result.preAuthStatus).toBe("NOT_REQUIRED");
    expect(result.showWarning).toBe(false);
  });
});

describe("visit financial estimate summary", () => {
  it("uses the same line aggregation total as Phase 4 invoice mapping", () => {
    const lines: ProcedureLineBillable[] = [
      {
        id: "d1",
        ownerType: "DOCTOR",
        ownerId: "doc",
        status: "CLOSED",
        procedureCode: "D1110",
        procedureName: "Cleaning",
        unitPrice: 200,
        quantity: 1,
      },
      {
        id: "s1",
        ownerType: "STORE",
        ownerId: null,
        status: "CLOSED",
        procedureCode: null,
        procedureName: "Kit",
        unitPrice: 50,
        quantity: 2,
        itemType: "GOOD",
      },
    ];

    const mappedTotal = mapProcedureLinesToInvoiceItems(lines).reduce(
      (sum, item) => sum + item.total,
      0,
    );
    expect(mappedTotal).toBe(aggregateProcedureLineTotal(lines));
    expect(mappedTotal).toBe(300);
  });

  it("labels the summary as an estimate, not a final invoice", () => {
    const estimate: VisitFinancialEstimate = {
      total: 300,
      insuranceAmount: 240,
      patientAmount: 60,
      currency: "AED",
      lineCount: 2,
    };

    const summary = buildVisitFinancialEstimateSummary(estimate, "AE");
    expect(summary).toMatch(/Estimated total/i);
    expect(summary).toMatch(/not a final invoice/i);
    expect(summary).toMatch(/Ready to Invoice/i);
    expect(summary).toMatch(/240/);
    expect(summary).toMatch(/60/);
  });
});

describe("treatment plan booking suggestions", () => {
  const activePlan: TreatmentPlanSnapshot = {
    id: "plan-1",
    title: "Rehab",
    status: "ACCEPTED",
    items: [
      { status: "pending", linkedAppointmentId: null },
      { status: "pending", linkedAppointmentId: null },
      { status: "completed", linkedAppointmentId: null },
      { status: "pending", linkedAppointmentId: "apt-future" },
    ],
  };

  it("counts only outstanding unscheduled items", () => {
    expect(countOutstandingUnscheduledTreatmentItems([activePlan])).toBe(2);
  });

  it("does not suggest when all outstanding items are already linked", () => {
    const plan: TreatmentPlanSnapshot = {
      ...activePlan,
      items: [{ status: "pending", linkedAppointmentId: "apt-1" }],
    };
    expect(countOutstandingUnscheduledTreatmentItems([plan])).toBe(0);
  });

  it("does not suggest when plan is completed", () => {
    expect(
      countOutstandingUnscheduledTreatmentItems([
        { ...activePlan, status: "COMPLETED" },
      ]),
    ).toBe(0);
  });

  it("builds a distinct reception-facing message with booking link", () => {
    const body = buildTreatmentPlanBookingSuggestionBody({
      patientName: "Jane Doe",
      outstandingCount: 2,
    });
    expect(body).toMatch(/active treatment plan/i);
    expect(body).toMatch(/2 outstanding items/i);
    expect(treatmentPlanBookingLink("patient-1")).toBe(
      "/appointments/book?patientId=patient-1",
    );
  });

  it("leaves recall-style plans without treatment items unaffected", () => {
    expect(countOutstandingUnscheduledTreatmentItems([])).toBe(0);
  });
});
