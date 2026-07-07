import { db } from "@/lib/db";
import { getTenantInvoiceTax } from "@/lib/billing/tenant-invoice-tax";
import {
  calculateIndiaGstInvoice,
  gstStateFromGstin,
  type IndiaGstLineInput,
  type InvoiceItemType,
} from "@/lib/billing/india-gst";

export type InvoiceTaxLineInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  procedureCode?: string | null;
  inventoryItemId?: string | null;
  itemType?: InvoiceItemType | null;
  gstRatePercent?: number | null;
  hsnCode?: string | null;
};

export type ComputedInvoiceLine = {
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

export type InvoiceTaxResult = {
  lines: ComputedInvoiceLine[];
  subtotal: number;
  exemptSubtotal: number;
  taxableSubtotal: number;
  tax: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  total: number;
  currency: string;
  taxName: string;
  taxNumber: string | null;
  taxRateApplied: number | null;
  isIndiaGst: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function enrichInventoryGst(
  tenantId: string,
  items: InvoiceTaxLineInput[],
): Promise<IndiaGstLineInput[]> {
  const inventoryIds = items
    .map((i) => i.inventoryItemId)
    .filter((id): id is string => Boolean(id));

  const inventoryMap = new Map<
    string,
    { taxRate: number | null; hsnCode: string | null }
  >();

  if (inventoryIds.length > 0) {
    const rows = await db.inventoryItem.findMany({
      where: { tenantId, id: { in: inventoryIds }, deletedAt: null },
      select: { id: true, taxRate: true, hsnCode: true },
    });
    for (const row of rows) {
      inventoryMap.set(row.id, {
        taxRate: row.taxRate != null ? Number(row.taxRate) : null,
        hsnCode: row.hsnCode,
      });
    }
  }

  return items.map((item) => {
    const inv = item.inventoryItemId ? inventoryMap.get(item.inventoryItemId) : undefined;
    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      procedureCode: item.procedureCode,
      inventoryItemId: item.inventoryItemId,
      gstRatePercent: item.gstRatePercent ?? inv?.taxRate ?? null,
      hsnCode: item.hsnCode ?? inv?.hsnCode ?? null,
    };
  });
}

export async function calculateInvoiceTaxAndLines(params: {
  tenantId: string;
  patientId: string;
  items: InvoiceTaxLineInput[];
}): Promise<InvoiceTaxResult> {
  const tenant = await db.tenant.findUnique({
    where: { id: params.tenantId },
    select: {
      countryCode: true,
      gstin: true,
      gstState: true,
      taxNumber: true,
    },
  });

  const taxInfo = await getTenantInvoiceTax(params.tenantId);
  const isIndia = tenant?.countryCode === "IN";

  if (!isIndia) {
    const lines: ComputedInvoiceLine[] = params.items.map((item) => {
      const total = round2(item.quantity * item.unitPrice);
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total,
        procedureCode: item.procedureCode ?? null,
        inventoryItemId: item.inventoryItemId ?? null,
        itemType: item.inventoryItemId ? "GOOD" : "SERVICE",
        hsnSacCode: null,
        gstRate: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
      };
    });

    const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
    const tax = round2(subtotal * taxInfo.taxRateDecimal);
    const total = round2(subtotal + tax);

    return {
      lines,
      subtotal,
      exemptSubtotal: 0,
      taxableSubtotal: subtotal,
      tax,
      cgstTotal: 0,
      sgstTotal: 0,
      igstTotal: 0,
      total,
      currency: taxInfo.currency,
      taxName: taxInfo.taxName,
      taxNumber: taxInfo.taxNumber,
      taxRateApplied: taxInfo.taxRatePercent,
      isIndiaGst: false,
    };
  }

  const patient = await db.patient.findFirst({
    where: { id: params.patientId, tenantId: params.tenantId, deletedAt: null },
    select: { state: true },
  });

  const clinicGstState =
    tenant.gstState?.trim() ||
    gstStateFromGstin(tenant.gstin) ||
    gstStateFromGstin(tenant.taxNumber);

  const enriched = await enrichInventoryGst(params.tenantId, params.items);
  const india = calculateIndiaGstInvoice(enriched, {
    clinicGstState,
    patientStateCode: patient?.state ?? clinicGstState,
  });

  return {
    lines: india.lines,
    subtotal: india.subtotal,
    exemptSubtotal: india.exemptSubtotal,
    taxableSubtotal: india.taxableSubtotal,
    tax: india.tax,
    cgstTotal: india.cgstTotal,
    sgstTotal: india.sgstTotal,
    igstTotal: india.igstTotal,
    total: india.total,
    currency: taxInfo.currency,
    taxName: "GST",
    taxNumber: tenant.gstin ?? tenant.taxNumber ?? taxInfo.taxNumber,
    taxRateApplied: null,
    isIndiaGst: true,
  };
}
