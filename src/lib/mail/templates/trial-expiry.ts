import { emailButton, emailLayout } from "./layout";

export type TrialExpiryEmailData = {
  clinicName: string;
  trialEndsAt: Date;
  upgradeUrl: string;
  daysRemaining: number;
};

export function buildTrialExpiryEmail(data: TrialExpiryEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const dayLabel = data.daysRemaining === 1 ? "day" : "days";
  const subject = `Your DentaFlow trial ends in ${data.daysRemaining} ${dayLabel}`;

  const text = [
    `Your DentaFlow trial for ${data.clinicName} expires on ${data.trialEndsAt.toLocaleDateString()}.`,
    `${data.daysRemaining} ${dayLabel} remaining.`,
    "",
    `Upgrade: ${data.upgradeUrl}`,
  ].join("\n");

  const html = emailLayout(`
    <p style="margin:0 0 16px;color:#fafafa;font-size:20px;font-weight:600;">Trial ending soon</p>
    <p style="margin:0 0 16px;">
      Your DentaFlow trial for <strong style="color:#fafafa;">${data.clinicName}</strong> expires on
      <strong style="color:#38bdf8;">${data.trialEndsAt.toLocaleDateString()}</strong>
      (${data.daysRemaining} ${dayLabel} remaining).
    </p>
    <p style="margin:0 0 16px;">
      Upgrade now to keep your data and continue serving your patients without interruption.
    </p>
    ${emailButton(data.upgradeUrl, "Upgrade your plan")}
  `);

  return { subject, text, html };
}
