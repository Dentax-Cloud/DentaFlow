import { getMailConfig } from "./config";
import { sendMail } from "./send";
import { buildProvisionEmail } from "./templates/provision";
import { buildWelcomeEmail } from "./templates/welcome";

export { getMailConfig, isMailConfigured } from "./config";
export { sendMail } from "./send";
export type { SendMailParams } from "./send";

export async function sendWelcomeEmail(params: {
  to: string;
  clinicName: string;
  adminName: string;
  trialDays?: number;
}): Promise<void> {
  const { appUrl } = getMailConfig();
  const { subject, text, html } = buildWelcomeEmail({
    adminName: params.adminName,
    clinicName: params.clinicName,
    trialDays: params.trialDays,
    dashboardUrl: `${appUrl}/dashboard`,
  });
  await sendMail({ to: params.to, subject, text, html });
}

export async function sendProvisionWelcomeEmail(params: {
  to: string;
  clinicName: string;
  adminName: string;
  trialDays?: number;
}): Promise<void> {
  const { appUrl } = getMailConfig();
  const { subject, text, html } = buildProvisionEmail({
    adminName: params.adminName,
    clinicName: params.clinicName,
    trialDays: params.trialDays,
    onboardingUrl: `${appUrl}/onboarding`,
  });
  await sendMail({ to: params.to, subject, text, html });
}
