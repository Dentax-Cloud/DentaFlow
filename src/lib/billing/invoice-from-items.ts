import { db } from "@/lib/db";
import { calculateInsuranceSplit } from "@/lib/billing/insurance-calculator";
import { getTenantInvoiceTax } from "@/lib/billing/tenant-invoice-tax";
import { generateInvoiceNumber } from "@/lib/utils";
import { generateInvoiceRef } from "@/lib/ids/generate-ids";
import { sendInvoiceEmailToPatient } from "@/lib/notifications/invoice-notifications";

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  procedureCode?: string | null;
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
 */
export async function createInvoiceFromItems(params: CreateInvoiceFromItemsParams) {
  const subtotal = params.items.reduce((sum, i) => sum + i.total, 0);
  const taxInfo = await getTenantInvoiceTax(params.tenantId);
  const tax = subtotal * taxInfo.taxRateDecimal;
  const total = subtotal + tax;

  const procedureCodes = params.items
    .map((i) => i.procedureCode)
    .filter((c): c is string => Boolean(c));

  const insuranceSplit = await calculateInsuranceSplit({
    tenantId: params.tenantId,
    patientId: params.patientId,
    procedureCodes,
    totalAmount: total,
  });

  const count = await db.invoice.count({ where: { tenantId: params.tenantId } });

  const invoice = await db.invoice.create({
    data: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      invoiceNumber: generateInvoiceNumber(count + 1),
      invoiceRef: await generateInvoiceRef(params.tenantId),
      status: params.status ?? "DRAFT",
      subtotal,
      tax,
      total,
      currency: taxInfo.currency,
      taxName: taxInfo.taxName,
      taxRateApplied: taxInfo.taxRatePercent,
      taxNumber: taxInfo.taxNumber,
      insuranceAmount: insuranceSplit?.insurerAmount ?? 0,
      patientAmount: insuranceSplit?.patientAmount ?? total,
      coPayPercent: insuranceSplit?.coPayPercent ?? null,
      providerCode: insuranceSplit?.providerName ?? null,
      networkType: insuranceSplit?.networkName ?? null,
      preAuthCode: insuranceSplit?.preAuthReference ?? null,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: params.notes ?? null,
      items: {
        create: params.items.map((item) => ({
          tenantId: params.tenantId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          procedureCode: item.procedureCode ?? null,
        })),
      },
    },
  });

  await sendInvoiceEmailToPatient({
    tenantId: params.tenantId,
    invoiceId: invoice.id,
  }).catch(() => null);

  return invoice;
}
