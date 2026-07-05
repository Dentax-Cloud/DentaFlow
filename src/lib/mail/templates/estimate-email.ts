import { emailLayout } from "./layout";

export type EstimateEmailData = {
  patientName: string;
  clinicName: string;
  totalFormatted: string;
  patientPortionFormatted: string;
  clinicPhone?: string | null;
};

export function buildEstimateEmail(data: EstimateEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Treatment cost estimate — ${data.clinicName}`;

  const text = [
    `Dear ${data.patientName},`,
    "",
    `Please find your treatment cost estimate attached from ${data.clinicName}.`,
    "",
    `Estimated total: ${data.totalFormatted}`,
    `Your estimated portion: ${data.patientPortionFormatted}`,
    "",
    "This estimate is not a guarantee of insurance payment.",
    data.clinicPhone ? `Questions? Call us at ${data.clinicPhone}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = emailLayout(`
    <p style="margin:0 0 16px;color:#fafafa;font-size:20px;font-weight:600;">Treatment estimate</p>
    <p style="margin:0 0 16px;">
      Dear ${data.patientName},<br><br>
      Please find your treatment cost estimate attached from
      <strong style="color:#fafafa;">${data.clinicName}</strong>.
    </p>
    <div style="background:#27272a;border:1px solid #3f3f46;border-radius:12px;padding:16px;margin:0 0 16px;">
      <p style="margin:4px 0;"><strong style="color:#fafafa;">Estimated total:</strong> ${data.totalFormatted}</p>
      <p style="margin:4px 0;"><strong style="color:#fafafa;">Your portion:</strong> ${data.patientPortionFormatted}</p>
    </div>
    <p style="margin:0;color:#71717a;font-size:12px;">
      This estimate is not a guarantee of insurance payment.
    </p>
  `);

  return { subject, text, html };
}
