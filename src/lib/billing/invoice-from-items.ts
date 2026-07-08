import { db } from "@/lib/db";
import { calculateInsuranceSplit } from "@/lib/billing/insurance-calculator";
import { calculateInvoiceTaxAndLines } from "@/lib/billing/calculate-invoice-tax";
import { generateInvoiceNumber } from "@/lib/utils";
import { generateInvoiceRef } from "@/lib/ids/generate-ids";
import { sendInvoiceEmailToPatient } from "@/lib/notifications/invoice-notifications";
import { maybeCreateDraftClaimForInvoice } from "@/lib/insurance/maybe-create-draft-claim";
import type { InvoiceItemType } from "@/lib/billing/india-gst";

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  procedureCode?: string | null;
  inventoryItemId?: string | null;
  itemType?: InvoiceItemType | null;
  gstRatePercent?: number | null;
  hsnCode?: string | null;
};

export type CreateInvoiceFromItemsParams = {
  tenantId: string;
  patientId: string;
  items: InvoiceLineItem[];
  notes?: string | null;
  status?: "DRAFT" | "SENT";
};

/**
 * Shared invoice creation with insurance split + pre-auth honor (via calculator).
 * Auto-suggests a DRAFT claim when insuranceAmount > 0 and a primary policy exists.
 */
export async function createInvoiceFromItems(params: CreateInvoiceFromItemsParams) {
  const taxResult = await calculateInvoiceTaxAndLines({
    tenantId: params.tenantId,
    patientId: params.patientId,
    items: params.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      procedureCode: item.procedureCode,
      inventoryItemId: item.inventoryItemId,
      itemType: item.itemType,
      gstRatePercent: item.gstRatePercent,
      hsnCode: item.hsnCode,
    })),
  });

  const procedureCodes = params.items
    .map((i) => i.procedureCode)
    .filter((c): c is string => Boolean(c));

  const insuranceSplit = await calculateInsuranceSplit({
    tenantId: params.tenantId,
    patientId: params.patientId,
    procedureCodes,
    totalAmount: taxResult.total,
  });

  const count = await db.invoice.count({ where: { tenantId: params.tenantId } });

  const invoice = await db.invoice.create({
    data: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      invoiceNumber: generateInvoiceNumber(count + 1),
      invoiceRef: await generateInvoiceRef(params.tenantId),
      status: params.status ?? "DRAFT",
      subtotal: taxResult.subtotal,
      tax: taxResult.tax,
      total: taxResult.total,
      exemptSubtotal: taxResult.exemptSubtotal,
      taxableSubtotal: taxResult.taxableSubtotal,
      cgstTotal: taxResult.cgstTotal,
      sgstTotal: taxResult.sgstTotal,
      igstTotal: taxResult.igstTotal,
      currency: taxResult.currency,
      taxName: taxResult.taxName,
      taxRateApplied: taxResult.taxRateApplied,
      taxNumber: taxResult.taxNumber,
      insuranceAmount: insuranceSplit?.insurerAmount ?? 0,
      patientAmount: insuranceSplit?.patientAmount ?? taxResult.total,
      coPayPercent: insuranceSplit?.coPayPercent ?? null,
      providerCode: insuranceSplit?.providerName ?? null,
      networkType: insuranceSplit?.networkName ?? null,
      preAuthCode: insuranceSplit?.preAuthReference ?? null,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: params.notes ?? null,
      items: {
        create: taxResult.lines.map((line) => ({
          tenantId: params.tenantId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: line.total,
          procedureCode: line.procedureCode,
          inventoryItemId: line.inventoryItemId,
          itemType: line.itemType,
          hsnSacCode: line.hsnSacCode,
          gstRate: line.gstRate,
          cgstAmount: line.cgstAmount,
          sgstAmount: line.sgstAmount,
          igstAmount: line.igstAmount,
        })),
      },
    },
  });

  await sendInvoiceEmailToPatient({
    tenantId: params.tenantId,
    invoiceId: invoice.id,
  }).catch(() => null);

  await maybeCreateDraftClaimForInvoice({
    tenantId: params.tenantId,
    invoiceId: invoice.id,
  }).catch(() => null);

  return invoice;
}
