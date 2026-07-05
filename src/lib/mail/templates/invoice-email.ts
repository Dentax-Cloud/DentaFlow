import { emailLayout } from "./layout";

export type InvoiceEmailData = {
  patientName: string;
  clinicName: string;
  invoiceNumber: string;
  totalFormatted: string;
  balanceDueFormatted: string;
  clinicPhone?: string | null;
};

export function buildInvoiceEmail(data: InvoiceEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Invoice from ${data.clinicName} — ${data.invoiceNumber}`;

  const text = [
    `Dear ${data.patientName},`,
    "",
    `Please find your invoice attached from ${data.clinicName}.`,
    "",
    `Invoice number: ${data.invoiceNumber}`,
    `Total: ${data.totalFormatted}`,
    `Balance due: ${data.balanceDueFormatted}`,
    "",
    data.clinicPhone ? `Questions? Call us at ${data.clinicPhone}.` : "",
    "",
    "Thank you for choosing our clinic.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = emailLayout(`
    <p style="margin:0 0 16px;color:#fafafa;font-size:20px;font-weight:600;">Your invoice</p>
    <p style="margin:0 0 16px;">
      Dear ${data.patientName},<br><br>
      Please find your invoice attached from
      <strong style="color:#fafafa;">${data.clinicName}</strong>.
    </p>
    <div style="background:#27272a;border:1px solid #3f3f46;border-radius:12px;padding:16px;margin:0 0 16px;">
      <p style="margin:4px 0;"><strong style="color:#fafafa;">Invoice:</strong> ${data.invoiceNumber}</p>
      <p style="margin:4px 0;"><strong style="color:#fafafa;">Total:</strong> ${data.totalFormatted}</p>
      <p style="margin:4px 0;"><strong style="color:#fafafa;">Balance due:</strong> ${data.balanceDueFormatted}</p>
    </div>
  `);

  return { subject, text, html };
}
