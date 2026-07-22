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
  materialUsages: Array<{ quantity: number; unitCost: number; itemName?: string | null }>;
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
  return usages.reduce((sum, u) => sum + u.quantity * u.unitCost, 0);
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
