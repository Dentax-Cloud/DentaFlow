/** SAC for exempt human health / dental services under Indian GST. */
export const INDIA_EXEMPT_SERVICE_SAC = "999319";

export type InvoiceItemType = "SERVICE" | "GOOD";

export type IndiaGstLineInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  procedureCode?: string | null;
  inventoryItemId?: string | null;
  /** GST % for goods (from inventory); ignored for services. */
  gstRatePercent?: number | null;
  hsnCode?: string | null;
};

export type IndiaGstComputedLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  procedureCode: string | null;
  inventoryItemId: string | null;
  itemType: InvoiceItemType;
  hsnSacCode: string | null;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
};

export type IndiaGstTotals = {
  lines: IndiaGstComputedLine[];
  exemptSubtotal: number;
  taxableSubtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  tax: number;
  subtotal: number;
  total: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveInvoiceItemType(input: {
  inventoryItemId?: string | null;
  procedureCode?: string | null;
  itemType?: InvoiceItemType | null;
}): InvoiceItemType {
  if (input.itemType === "GOOD" || input.itemType === "SERVICE") {
    return input.itemType;
  }
  if (input.inventoryItemId) return "GOOD";
  return "SERVICE";
}

/** Compare 2-digit GST state codes; inter-state when patient code differs from clinic. */
export function isInterStateGst(
  clinicGstState: string | null | undefined,
  patientStateCode: string | null | undefined,
): boolean {
  const clinic = clinicGstState?.trim();
  const patient = patientStateCode?.trim();
  if (!clinic || !patient) return false;
  return clinic !== patient;
}

/** First two digits of a valid GSTIN are the state code. */
export function gstStateFromGstin(gstin: string | null | undefined): string | null {
  const trimmed = gstin?.trim();
  if (!trimmed || trimmed.length < 2) return null;
  const code = trimmed.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

export function splitIndiaGstAmounts(
  taxableValue: number,
  gstRatePercent: number,
  interState: boolean,
): { cgstAmount: number; sgstAmount: number; igstAmount: number } {
  if (gstRatePercent <= 0 || taxableValue <= 0) {
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
  }
  const tax = round2(taxableValue * (gstRatePercent / 100));
  if (interState) {
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: tax };
  }
  const half = round2(tax / 2);
  return { cgstAmount: half, sgstAmount: round2(tax - half), igstAmount: 0 };
}

export function calculateIndiaGstInvoice(
  items: IndiaGstLineInput[],
  options: {
    clinicGstState: string | null;
    patientStateCode: string | null;
  },
): IndiaGstTotals {
  const interState = isInterStateGst(options.clinicGstState, options.patientStateCode);

  let exemptSubtotal = 0;
  let taxableSubtotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const lines: IndiaGstComputedLine[] = items.map((item) => {
    const itemType = resolveInvoiceItemType(item);
    const lineTotal = round2(item.quantity * item.unitPrice);

    if (itemType === "SERVICE") {
      exemptSubtotal = round2(exemptSubtotal + lineTotal);
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: lineTotal,
        procedureCode: item.procedureCode ?? null,
        inventoryItemId: null,
        itemType: "SERVICE" as const,
        hsnSacCode: INDIA_EXEMPT_SERVICE_SAC,
        gstRate: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
      };
    }

    const gstRate = Number(item.gstRatePercent ?? 0);
    taxableSubtotal = round2(taxableSubtotal + lineTotal);
    const { cgstAmount, sgstAmount, igstAmount } = splitIndiaGstAmounts(
      lineTotal,
      gstRate,
      interState,
    );
    cgstTotal = round2(cgstTotal + cgstAmount);
    sgstTotal = round2(sgstTotal + sgstAmount);
    igstTotal = round2(igstTotal + igstAmount);

    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: lineTotal,
      procedureCode: item.procedureCode ?? null,
      inventoryItemId: item.inventoryItemId ?? null,
      itemType: "GOOD" as const,
      hsnSacCode: item.hsnCode?.trim() || null,
      gstRate,
      cgstAmount,
      sgstAmount,
      igstAmount,
    };
  });

  const tax = round2(cgstTotal + sgstTotal + igstTotal);
  const subtotal = round2(exemptSubtotal + taxableSubtotal);
  const total = round2(subtotal + tax);

  return {
    lines,
    exemptSubtotal,
    taxableSubtotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    tax,
    subtotal,
    total,
  };
}
