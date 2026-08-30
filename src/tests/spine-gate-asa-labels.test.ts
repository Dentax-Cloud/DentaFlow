import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GateAssertionError } from "@/lib/encounter/errors";
import {
  assertExamCompleteForGatesTransition,
  assertExamDocumentationComplete,
} from "@/lib/encounter/exam";
import {
  ASA_CLASS_VALUES,
  isValidAsaClass,
  normalizeAsaClass,
  requireAsaClassForRiskClear,
} from "@/lib/encounter/asa-class";
import {
  assertProcedureStartGatesFromSummary,
  formatBlockedStageTransition,
  formatCollapsedGateSummary,
  spineForwardTransitionBlocker,
} from "@/lib/encounter/stage-transition-blockers";
import {
  catchSpineExpectedFailure,
  withSpineExpectedFailureCatch,
} from "@/lib/encounter/spine-action-result";
import { SpineStatusTransitions } from "@/app/(dashboard)/clinical/encounter/[appointmentId]/spine/spine-status-transitions";
import type { GateSummary } from "@/lib/encounter/types";

afterEach(() => {
  cleanup();
});

const ALL_CLEAR: GateSummary = {
  risk: "cleared",
  consent: "cleared",
  insurance: "cleared",
  sterilization: "pending",
};

const INSURANCE_BLOCKED: GateSummary = {
  risk: "cleared",
  consent: "cleared",
  insurance: "blocked",
  sterilization: "pending",
};

describe("wrapped gate / stage-transition failures", () => {
  it("returns { ok: false, error } naming the blocked gate instead of a generic all-clear throw", async () => {
    const result = await withSpineExpectedFailureCatch(async () => {
      assertProcedureStartGatesFromSummary(INSURANCE_BLOCKED);
    });
    expect(result).toEqual({
      ok: false,
      error: "Can't move to Procedure Execution yet: Insurance is still blocked",
    });
    expect(result).not.toMatchObject({
      error: expect.stringMatching(/gates must all be clear/i),
    });
  });

  it("lists every blocking gate when several are uncleared", async () => {
    const result = await withSpineExpectedFailureCatch(async () => {
      assertProcedureStartGatesFromSummary({
        risk: "cleared",
        consent: "blocked",
        insurance: "pending",
        sterilization: "pending",
      });
    });
    expect(result).toEqual({
      ok: false,
      error:
        "Can't move to Procedure Execution yet: Consent and Insurance are still blocked",
    });
  });

  it("wraps exam→gates incomplete exam as GateAssertionError, not a plain Error", async () => {
    expect(() =>
      assertExamCompleteForGatesTransition({
        examCompletedAt: null,
        examinedByStaffId: null,
      }),
    ).toThrow(GateAssertionError);

    const result = await withSpineExpectedFailureCatch(async () => {
      assertExamCompleteForGatesTransition({
        examCompletedAt: null,
        examinedByStaffId: null,
      });
    });
    expect(result).toEqual({
      ok: false,
      error: "Can't move to Gates yet: Exam is still incomplete",
    });

    const plain = new Error(
      "Risk, consent, and insurance gates must all be clear before procedures.",
    );
    expect(() => catchSpineExpectedFailure(plain)).toThrow(plain);
  });

  it("lists missing exam fields as GateAssertionError, not a plain Error", async () => {
    expect(() =>
      assertExamDocumentationComplete({
        chiefComplaint: "Pain",
        findings: "  ",
        provisionalDiagnosis: "",
      }),
    ).toThrow(GateAssertionError);

    const missingBoth = await withSpineExpectedFailureCatch(async () => {
      assertExamDocumentationComplete({
        chiefComplaint: "Pain",
        findings: "",
        provisionalDiagnosis: "",
      });
    });
    expect(missingBoth).toEqual({
      ok: false,
      error: "Findings and Provisional diagnosis are required to complete the exam.",
    });

    const missingFindings = await withSpineExpectedFailureCatch(async () => {
      assertExamDocumentationComplete({
        chiefComplaint: "",
        findings: "Caries",
        provisionalDiagnosis: "",
      });
    });
    expect(missingFindings).toEqual({
      ok: false,
      error: "Chief complaint and Provisional diagnosis are required to complete the exam.",
    });

    const missingDiagnosis = await withSpineExpectedFailureCatch(async () => {
      assertExamDocumentationComplete({
        chiefComplaint: "",
        findings: "",
        provisionalDiagnosis: "K02.9",
      });
    });
    expect(missingDiagnosis).toEqual({
      ok: false,
      error: "Chief complaint and Findings are required to complete the exam.",
    });

    const plain = new Error(
      "Chief complaint, findings, and provisional diagnosis are required to complete the exam.",
    );
    expect(() => catchSpineExpectedFailure(plain)).toThrow(plain);
  });

  it("does not treat a completed exam as blocked just because insurance is blocked", () => {
    expect(
      spineForwardTransitionBlocker({
        toStatus: "gates",
        examCompletedAt: new Date().toISOString(),
        examinedByStaffId: "staff-1",
        gates: INSURANCE_BLOCKED,
      }),
    ).toBeNull();
  });
});

describe("collapsed gate labels", () => {
  it("uses full gate names, not single-letter abbreviations", () => {
    const collapsed = formatCollapsedGateSummary(ALL_CLEAR);
    expect(collapsed).toBe(
      "Risk cleared · Consent cleared · Insurance cleared · Sterilization pending",
    );
    expect(collapsed).not.toMatch(/\bR cleared\b/);
    expect(collapsed).not.toMatch(/\bC cleared\b/);
    expect(collapsed).not.toMatch(/\bI cleared\b/);
    expect(collapsed).not.toMatch(/\bS pending\b/);
  });

  it("mirrors overridden insurance from the expanded Gate summary", () => {
    expect(
      formatCollapsedGateSummary(INSURANCE_BLOCKED, { insuranceOverridden: true }),
    ).toContain("Insurance overridden");
  });
});

describe("STATUS precondition (before click)", () => {
  it("disables the procedure-execution button and shows the blocker inline", () => {
    const onAdvance = vi.fn();
    render(
      createElement(SpineStatusTransitions, {
        nextStatuses: ["procedure_execution"],
        write: true,
        examCompletedAt: new Date().toISOString(),
        examinedByStaffId: "staff-1",
        gates: INSURANCE_BLOCKED,
        onAdvance,
      }),
    );

    const button = screen.getByRole("button", {
      name: /procedure execution/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe(
      "Can't move to Procedure Execution yet: Insurance is still blocked",
    );
    expect(
      screen.getByText(
        "Can't move to Procedure Execution yet: Insurance is still blocked",
      ),
    ).toBeTruthy();

    fireEvent.click(button);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("disables exam→gates when the exam is incomplete", () => {
    render(
      createElement(SpineStatusTransitions, {
        nextStatuses: ["gates"],
        write: true,
        examCompletedAt: null,
        examinedByStaffId: null,
        gates: ALL_CLEAR,
        onAdvance: () => {},
      }),
    );
    const button = screen.getByRole("button", { name: /→ gates/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Can't move to Gates yet: Exam is still incomplete")).toBeTruthy();
  });

  it("keeps a clear transition clickable", () => {
    const onAdvance = vi.fn();
    render(
      createElement(SpineStatusTransitions, {
        nextStatuses: ["procedure_execution"],
        write: true,
        examCompletedAt: new Date().toISOString(),
        examinedByStaffId: "staff-1",
        gates: ALL_CLEAR,
        onAdvance,
      }),
    );
    const button = screen.getByRole("button", {
      name: /procedure execution/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onAdvance).toHaveBeenCalledWith("procedure_execution");
  });
});

describe("ASA class selector", () => {
  it("accepts I–VI with optional emergency E suffix and rejects empty/free-text", () => {
    expect(normalizeAsaClass("")).toBeNull();
    expect(normalizeAsaClass("  ")).toBeNull();
    expect(normalizeAsaClass("seven")).toBeNull();
    expect(normalizeAsaClass("II")).toBe("II");
    expect(normalizeAsaClass("ii-e")).toBe("II-E");
    expect(normalizeAsaClass("IIE")).toBe("II-E");
    expect(normalizeAsaClass("ASA III")).toBe("III");
    expect(isValidAsaClass("")).toBe(false);
    expect(isValidAsaClass("II")).toBe(true);
    expect(ASA_CLASS_VALUES).toContain("VI-E");
    expect(() => requireAsaClassForRiskClear("")).toThrow(GateAssertionError);
  });
});

describe("call-site wiring", () => {
  it("wraps gate-advance and exam→gates actions and drops the generic all-clear wording", () => {
    const actions = readFileSync(
      path.resolve(
        process.cwd(),
        "src/app/(dashboard)/features/clinical/encounter-spine-actions.ts",
      ),
      "utf8",
    );
    const billing = readFileSync(
      path.resolve(process.cwd(), "src/lib/encounter/billing.ts"),
      "utf8",
    );
    const client = readFileSync(
      path.resolve(
        process.cwd(),
        "src/app/(dashboard)/clinical/encounter/[appointmentId]/spine/spine-workspace-client.tsx",
      ),
      "utf8",
    );

    expect(extractFn(actions, "advanceSpinePastGates")).toContain(
      "withSpineExpectedFailureCatch",
    );
    expect(extractFn(actions, "transitionSpineEncounter")).toContain(
      "withSpineExpectedFailureCatch",
    );
    expect(extractFn(actions, "clearSpineRisk")).toContain("requireAsaClassForRiskClear");
    expect(extractFn(actions, "grantSpineConsent")).toContain(
      "withSpineExpectedFailureCatch",
    );
    expect(billing).not.toMatch(
      /Risk, consent, and insurance gates must all be clear/,
    );
    expect(client).toContain("formatCollapsedGateSummary");
    expect(client).toContain("isValidAsaClass(draft.asaClass)");
    expect(client).not.toContain('placeholder="e.g. II"');
    expect(client).not.toMatch(/R \$\{gates\.risk\}/);
  });
});

describe("formatBlockedStageTransition copy", () => {
  it("matches the doctor-facing single-gate wording", () => {
    expect(
      formatBlockedStageTransition("Procedure Execution", [
        { label: "Consent", status: "blocked" },
      ]),
    ).toBe("Can't move to Procedure Execution yet: Consent is still blocked");
  });
});

function extractFn(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}
