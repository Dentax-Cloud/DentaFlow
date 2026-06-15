import { TRIAL_DURATION_DAYS } from "@/lib/tenant/trial";
import { emailButton, emailLayout } from "./layout";

export type ProvisionEmailData = {
  adminName: string;
  clinicName: string;
  onboardingUrl: string;
  trialDays?: number;
};

export function buildProvisionEmail(data: ProvisionEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const trialDays = data.trialDays ?? TRIAL_DURATION_DAYS;
  const subject = `Your DentaFlow clinic workspace was created`;

  const text = [
    `Hi ${data.adminName},`,
    "",
    `We've created the workspace for ${data.clinicName} on DentaFlow.`,
    "",
    `Complete your clinic profile to unlock your ${trialDays}-day STARTER trial:`,
    data.onboardingUrl,
    "",
    "— The DentaFlow Team",
  ].join("\n");

  const html = emailLayout(`
    <p style="margin:0 0 16px;color:#fafafa;font-size:20px;font-weight:600;">Almost there, ${data.adminName}!</p>
    <p style="margin:0 0 16px;">Your workspace for <strong style="color:#fafafa;">${data.clinicName}</strong> has been created.</p>
    <p style="margin:0 0 16px;">Finish setup to start your <strong style="color:#38bdf8;">${trialDays}-day free trial</strong> on the STARTER plan.</p>
    ${emailButton(data.onboardingUrl, "Complete clinic setup")}
  `);

  return { subject, text, html };
}
