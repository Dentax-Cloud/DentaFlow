import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SpineBillingDrawer } from "@/app/(dashboard)/clinical/encounter/[appointmentId]/spine/spine-billing-drawer";
import type { SpineBillingPreview } from "@/lib/encounter/billing-preview";

afterEach(() => {
  cleanup();
});

const postClosePreview: SpineBillingPreview = {
  lines: [
    {
      id: "line-1",
      code: "GPMR-APP001",
      name: "Occlusal Night Guard",
      status: "completed",
      unitPrice: 588,
      materialsCost: 0,
      billable: false,
      alreadyInvoiced: true,
    },
  ],
  proceduresSubtotal: 588,
  materialsSubtotal: 0,
  billableSubtotal: 0,
  estimatedCoverage: 0,
  estimatedCopay: 0,
  projectedTotal: 0,
  gateMessage:
    "No billable procedure or material lines to invoice. Complete at least one procedure line before closing.",
};

describe("SpineBillingDrawer post-close display", () => {
  it("shows invoiced total and hides the empty-billable warning when billedInvoice is set", () => {
    render(
      createElement(SpineBillingDrawer, {
        preview: postClosePreview,
        billedInvoice: {
          invoiceNumber: "INV-000023",
          total: 588,
          status: "draft",
        },
        insuranceChipStatus: "cleared" as const,
        open: true,
        onOpenChange: () => {},
      }),
    );

    const summary = screen.getByTestId("spine-invoiced-summary");
    expect(summary.textContent).toMatch(
      /Invoiced:\s*INV-000023\s*·\s*588\.00/,
    );
    expect(screen.getByText("Invoiced total")).toBeTruthy();
    expect(screen.queryByText(/No billable procedure/i)).toBeNull();
    expect(screen.getByText(/· invoiced/i)).toBeTruthy();
  });

  it("still shows the gate warning when nothing is billable and no invoice exists", () => {
    render(
      createElement(SpineBillingDrawer, {
        preview: postClosePreview,
        billedInvoice: null,
        insuranceChipStatus: "blocked" as const,
        open: true,
        onOpenChange: () => {},
      }),
    );

    expect(screen.getByText(/No billable procedure/i)).toBeTruthy();
    expect(screen.queryByTestId("spine-invoiced-summary")).toBeNull();
    expect(screen.getByText("Projected total")).toBeTruthy();
  });

  it("shows BLOCKED for stale insurance (same chip status as Gate Summary)", () => {
    render(
      createElement(SpineBillingDrawer, {
        preview: postClosePreview,
        billedInvoice: null,
        insuranceChipStatus: "blocked" as const,
        insuranceLabel: "Insurance (stale)",
        open: true,
        onOpenChange: () => {},
      }),
    );

    expect(screen.getByText("Insurance (stale)")).toBeTruthy();
    expect(screen.getByText("BLOCKED")).toBeTruthy();
    expect(screen.queryByText("PENDING")).toBeNull();
  });
});
