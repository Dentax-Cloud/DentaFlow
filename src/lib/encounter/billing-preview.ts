import {
  getEncounterInvoiceGateMessage,
  isSpineLineIncludedInInvoice,
} from "./billing-selection";

export type SpineBillingLineInput = {
  id: string;
  status: string;
  billedInvoiceId?: string | null;
  unitPrice: number | null;
  procedureCatalog: { code: string; name: string; price: number };
  materialUsages: Array<{
    quantity: number;
    unitCost: number;
    itemName?: string | null;
    /** Missing/undefined treated as true (legacy usages). */
    isBillable?: boolean;
    /** Returned materials never contribute to invoice/preview totals. */
    status?: string | null;
  }>;
};

export type SpineBillingPreview = {
  lines: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    unitPrice: number;
    materialsCost: number;
    billable: boolean;
    /** Line already linked to an invoice (excluded from further billing). */
    alreadyInvoiced: boolean;
  }>;
  /** Sum of all line unit prices (display). */
  proceduresSubtotal: number;
  /** Sum of all materials across lines. */
  materialsSubtotal: number;
  /** Only billable lines + their materials (same inclusion as invoice). */
  billableSubtotal: number;
  estimatedCoverage: number;
  estimatedCopay: number;
  /** billableSubtotal (pre-tax); tax applies at invoice time. */
  projectedTotal: number;
  gateMessage: string | null;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function lineUnitPrice(line: SpineBillingLineInput): number {
  return line.unitPrice ?? line.procedureCatalog.price;
}

function lineMaterialsCost(
  usages: SpineBillingLineInput["materialUsages"],
): number {
  // Align with buildInvoiceItemsFromEncounter: only billable, non-returned materials.
  return usages
    .filter((u) => u.status !== "returned" && u.isBillable !== false)
    .reduce((sum, u) => sum + u.quantity * u.unitCost, 0);
}

export function buildSpineBillingPreview(params: {
  lines: SpineBillingLineInput[];
  interruptOutcome?: string | null;
  estimatedCoverage?: number;
  estimatedCopay?: number;
}): SpineBillingPreview {
  const partialBill = params.interruptOutcome === "abandoned_partial_bill";
  const opts = { partialBill };

  const lines = params.lines.map((line) => {
    const unitPrice = roundMoney(lineUnitPrice(line));
    const materialsCost = roundMoney(lineMaterialsCost(line.materialUsages));
    const billable = isSpineLineIncludedInInvoice(line, opts);
    return {
      id: line.id,
      code: line.procedureCatalog.code,
      name: line.procedureCatalog.name,
      status: line.status,
      unitPrice,
      materialsCost,
      billable,
      alreadyInvoiced: Boolean(line.billedInvoiceId),
    };
  });

  const proceduresSubtotal = roundMoney(
    lines.reduce((sum, l) => sum + l.unitPrice, 0),
  );
  const materialsSubtotal = roundMoney(
    lines.reduce((sum, l) => sum + l.materialsCost, 0),
  );
  const billableSubtotal = roundMoney(
    lines
      .filter((l) => l.billable)
      .reduce((sum, l) => sum + l.unitPrice + l.materialsCost, 0),
  );

  const estimatedCoverage = roundMoney(params.estimatedCoverage ?? 0);
  const estimatedCopay = roundMoney(params.estimatedCopay ?? 0);

  return {
    lines,
    proceduresSubtotal,
    materialsSubtotal,
    billableSubtotal,
    estimatedCoverage,
    estimatedCopay,
    projectedTotal: billableSubtotal,
    gateMessage: getEncounterInvoiceGateMessage(params.lines, opts),
  };
}
