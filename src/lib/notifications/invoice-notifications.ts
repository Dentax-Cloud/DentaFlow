import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/countries";
import {
  generateInvoicePdf,
  generatePaymentReceiptPdf,
} from "@/lib/billing/invoice-pdf";
import { buildEstimatePdfBytes } from "@/lib/insurance/generate-estimate-pdf";
import type { ProcedureCodeSnapshot } from "@/lib/insurance/estimate-types";
import { createNotification } from "@/lib/notifications/notification-service";
import { sendMail } from "@/lib/mail";
import { buildInvoiceEmail } from "@/lib/mail/templates/invoice-email";
import { buildPaymentReceiptEmail } from "@/lib/mail/templates/payment-receipt-email";
import { buildEstimateEmail } from "@/lib/mail/templates/estimate-email";

export async function notifyInvoicePaid(params: {
  tenantId: string;
  invoiceId: string;
  patientId: string;
  amount: number;
}) {
  const admins = await db.staffMember.findMany({
    where: {
      tenantId: params.tenantId,
      role: { in: ["ADMIN", "OWNER", "FINANCE", "ACCOUNTANT"] },
      deletedAt: null,
    },
    select: { id: true, email: true },
    take: 5,
  });

  const patient = await db.patient.findFirst({
    where: { id: params.patientId, tenantId: params.tenantId },
    select: { firstName: true, lastName: true },
  });
  const patientName = patient
    ? `${patient.firstName} ${patient.lastName}`.trim()
    : "Patient";

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        tenantId: params.tenantId,
        recipientId: admin.id,
        type: "INVOICE_PAID",
        title: "Invoice paid",
        body: `${patientName} paid invoice (${params.amount.toFixed(2)}).`,
        link: `/billing?invoiceId=${params.invoiceId}`,
        entityType: "Invoice",
        entityId: params.invoiceId,
        channel: "IN_APP",
      }),
    ),
  );
}

/** Email invoice PDF to patient; sets emailedAt on success. */
export async function sendInvoiceEmailToPatient(params: {
  tenantId: string;
  invoiceId: string;
}): Promise<boolean> {
  const invoice = await db.invoice.findFirst({
    where: { id: params.invoiceId, tenantId: params.tenantId, deletedAt: null },
    include: {
      patient: { select: { firstName: true, lastName: true, email: true } },
      payments: true,
      tenant: { select: { name: true, phone: true, countryCode: true, currency: true } },
    },
  });
  if (!invoice?.patient.email) return false;

  const pdfBytes = await generateInvoicePdf(params.tenantId, params.invoiceId);
  if (!pdfBytes) return false;

  const countryCode = invoice.tenant.countryCode ?? "AE";
  const amountPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Math.max(0, Number(invoice.total) - amountPaid);

  const { subject, text, html } = buildInvoiceEmail({
    patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`.trim(),
    clinicName: invoice.tenant.name,
    invoiceNumber: invoice.invoiceNumber,
    totalFormatted: formatCurrency(Number(invoice.total), countryCode),
    balanceDueFormatted: formatCurrency(balanceDue, countryCode),
    clinicPhone: invoice.tenant.phone,
  });

  const sent = await sendMail({
    to: invoice.patient.email,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `invoice-${invoice.invoiceNumber.replace(/[^\w.-]+/g, "_")}.pdf`,
        content: Buffer.from(pdfBytes),
      },
    ],
  }).catch(() => false);

  if (sent) {
    await db.invoice.update({
      where: { id: invoice.id },
      data: { emailedAt: new Date() },
    });
  }

  return sent;
}

/** Email payment receipt PDF to patient (separate from initial invoice email). */
export async function sendPaymentReceiptEmailToPatient(params: {
  tenantId: string;
  invoiceId: string;
  paymentId: string;
}): Promise<boolean> {
  const invoice = await db.invoice.findFirst({
    where: { id: params.invoiceId, tenantId: params.tenantId, deletedAt: null },
    include: {
      patient: { select: { firstName: true, lastName: true, email: true } },
      payments: true,
      tenant: { select: { name: true, phone: true, countryCode: true } },
    },
  });
  if (!invoice?.patient.email) return false;

  const payment = invoice.payments.find((p) => p.id === params.paymentId);
  if (!payment) return false;

  const pdfBytes = await generatePaymentReceiptPdf(
    params.tenantId,
    params.invoiceId,
    params.paymentId,
  );
  if (!pdfBytes) return false;

  const countryCode = invoice.tenant.countryCode ?? "AE";
  const amountPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Math.max(0, Number(invoice.total) - amountPaid);

  const { subject, text, html } = buildPaymentReceiptEmail({
    patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`.trim(),
    clinicName: invoice.tenant.name,
    invoiceNumber: invoice.invoiceNumber,
    paymentAmountFormatted: formatCurrency(Number(payment.amount), countryCode),
    balanceDueFormatted: formatCurrency(balanceDue, countryCode),
    clinicPhone: invoice.tenant.phone,
  });

  return sendMail({
    to: invoice.patient.email,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `receipt-${invoice.invoiceNumber.replace(/[^\w.-]+/g, "_")}.pdf`,
        content: Buffer.from(pdfBytes),
      },
    ],
  }).catch(() => false);
}

/** @deprecated Use sendPaymentReceiptEmailToPatient */
export async function sendInvoiceReceiptEmail(params: {
  tenantId: string;
  invoiceId: string;
}) {
  const latestPayment = await db.payment.findFirst({
    where: { invoiceId: params.invoiceId, tenantId: params.tenantId },
    orderBy: { paidAt: "desc" },
    select: { id: true },
  });
  if (!latestPayment) return false;
  return sendPaymentReceiptEmailToPatient({
    ...params,
    paymentId: latestPayment.id,
  });
}

/** Email treatment estimate PDF to patient (snapshot at send time). */
export async function sendEstimateEmailToPatient(params: {
  tenantId: string;
  estimateId: string;
}): Promise<boolean> {
  const estimate = await db.treatmentEstimate.findFirst({
    where: { id: params.estimateId, tenantId: params.tenantId },
    include: {
      patient: { select: { firstName: true, lastName: true, email: true } },
      policy: { include: { provider: true } },
      tenant: {
        select: { name: true, phone: true, address: true, countryCode: true },
      },
    },
  });
  if (!estimate?.patient.email) return false;

  const procedures = estimate.procedureCodes as ProcedureCodeSnapshot[];
  const countryCode = estimate.tenant.countryCode ?? "AE";

  const pdfBytes = await buildEstimatePdfBytes({
    clinicName: estimate.tenant.name,
    clinicAddress: estimate.tenant.address ?? undefined,
    patientName: `${estimate.patient.firstName} ${estimate.patient.lastName}`.trim(),
    providerName:
      estimate.policy?.provider?.name ??
      estimate.policy?.providerNameFreeText ??
      undefined,
    networkName: estimate.policy?.networkTier ?? undefined,
    procedures,
    totalAmount: Number(estimate.totalAmount),
    insurerAmount: Number(estimate.estimatedInsurerAmount),
    patientAmount: Number(estimate.estimatedPatientAmount),
    countryCode,
    generatedAt: estimate.generatedAt,
  });

  const { subject, text, html } = buildEstimateEmail({
    patientName: `${estimate.patient.firstName} ${estimate.patient.lastName}`.trim(),
    clinicName: estimate.tenant.name,
    totalFormatted: formatCurrency(Number(estimate.totalAmount), countryCode),
    patientPortionFormatted: formatCurrency(
      Number(estimate.estimatedPatientAmount),
      countryCode,
    ),
    clinicPhone: estimate.tenant.phone,
  });

  return sendMail({
    to: estimate.patient.email,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `treatment-estimate-${estimate.id.slice(0, 8)}.pdf`,
        content: Buffer.from(pdfBytes),
      },
    ],
  }).catch(() => false);
}
