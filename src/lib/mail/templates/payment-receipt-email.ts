import { emailLayout } from "./layout";

export type PaymentReceiptEmailData = {
  patientName: string;
  clinicName: string;
  invoiceNumber: string;
  paymentAmountFormatted: string;
  balanceDueFormatted: string;
  clinicPhone?: string | null;
};

export function buildPaymentReceiptEmail(data: PaymentReceiptEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Payment receipt — ${data.clinicName}`;

  const text = [
    `Dear ${data.patientName},`,
    "",
    `Thank you for your payment to ${data.clinicName}.`,
    "",
    `Invoice: ${data.invoiceNumber}`,
    `Amount paid: ${data.paymentAmountFormatted}`,
    `Remaining balance: ${data.balanceDueFormatted}`,
    "",
    "A detailed receipt is attached to this email.",
    data.clinicPhone ? `Questions? Call us at ${data.clinicPhone}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = emailLayout(`
    <p style="margin:0 0 16px;color:#fafafa;font-size:20px;font-weight:600;">Payment received</p>
    <p style="margin:0 0 16px;">
      Dear ${data.patientName},<br><br>
      Thank you for your payment to
      <strong style="color:#fafafa;">${data.clinicName}</strong>.
    </p>
    <div style="background:#27272a;border:1px solid #3f3f46;border-radius:12px;padding:16px;margin:0 0 16px;">
      <p style="margin:4px 0;"><strong style="color:#fafafa;">Invoice:</strong> ${data.invoiceNumber}</p>
      <p style="margin:4px 0;"><strong style="color:#fafafa;">Amount paid:</strong> ${data.paymentAmountFormatted}</p>
      <p style="margin:4px 0;"><strong style="color:#fafafa;">Remaining balance:</strong> ${data.balanceDueFormatted}</p>
    </div>
    <p style="margin:0;color:#a1a1aa;font-size:13px;">A detailed receipt is attached.</p>
  `);

  return { subject, text, html };
}
