import { db } from "@/lib/db";
import {
  buildInvoicePdfBytes,
  type InvoicePdfInput,
} from "@/lib/billing/generate-invoice-pdf";

type PaymentReceiptContext = {
  paymentId: string;
};

async function loadInvoicePdfInput(
  tenantId: string,
  invoiceId: string,
  receipt?: PaymentReceiptContext,
): Promise<InvoicePdfInput | null> {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, tenantId, deletedAt: null },
    include: {
      patient: {
        select: { firstName: true, lastName: true },
      },
      items: true,
      payments: { orderBy: { paidAt: "asc" } },
      tenant: {
        select: {
          name: true,
          address: true,
          phone: true,
          email: true,
          taxNumber: true,
          countryCode: true,
          currency: true,
        },
      },
    },
  });

  if (!invoice) return null;

  const amountPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const total = Number(invoice.total);
  const balanceDue = Math.max(0, total - amountPaid);

  const receiptPayment = receipt
    ? invoice.payments.find((p) => p.id === receipt.paymentId)
    : undefined;

  return {
    clinicName: invoice.tenant.name,
    clinicAddress: invoice.tenant.address,
    clinicPhone: invoice.tenant.phone,
    clinicEmail: invoice.tenant.email,
    taxNumber: invoice.taxNumber ?? invoice.tenant.taxNumber,
    invoiceNumber: invoice.invoiceNumber,
    invoiceRef: invoice.invoiceRef,
    invoiceDate: invoice.createdAt,
    patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`.trim(),
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
      procedureCode: item.procedureCode,
    })),
    subtotal: Number(invoice.subtotal),
    tax: Number(invoice.tax),
    taxName: invoice.taxName,
    total,
    currency: invoice.currency,
    countryCode: invoice.tenant.countryCode ?? "AE",
    insuranceAmount: Number(invoice.insuranceAmount ?? 0),
    patientAmount: Number(invoice.patientAmount ?? total),
    providerCode: invoice.providerCode,
    networkType: invoice.networkType,
    preAuthCode: invoice.preAuthCode,
    status: invoice.status,
    amountPaid,
    balanceDue,
    receiptPaymentAmount: receiptPayment ? Number(receiptPayment.amount) : undefined,
    receiptPaymentMethod: receiptPayment?.method,
    receiptPaymentDate: receiptPayment?.paidAt,
  };
}

/** Build invoice PDF bytes (on-demand snapshot; not persisted). */
export async function generateInvoicePdf(
  tenantId: string,
  invoiceId: string,
): Promise<Uint8Array | null> {
  const input = await loadInvoicePdfInput(tenantId, invoiceId);
  if (!input) return null;
  return buildInvoicePdfBytes(input);
}

/** Build payment-receipt PDF bytes for a specific payment on an invoice. */
export async function generatePaymentReceiptPdf(
  tenantId: string,
  invoiceId: string,
  paymentId: string,
): Promise<Uint8Array | null> {
  const input = await loadInvoicePdfInput(tenantId, invoiceId, { paymentId });
  if (!input) return null;
  return buildInvoicePdfBytes(input);
}
