import { getMailConfig } from "./config";
import { sendMail } from "./send";
import { buildAppointmentReminderEmail } from "./templates/appointment-reminder";
import { buildProvisionEmail } from "./templates/provision";
import { buildTeamInviteEmail } from "./templates/team-invite";
import { buildTrialExpiryEmail } from "./templates/trial-expiry";
import { buildWelcomeEmail } from "./templates/welcome";

export { getMailConfig, isMailConfigured } from "./config";
export { sendMail, getMailTransporter } from "./send";
export type { SendMailParams } from "./send";

export async function sendWelcomeEmail(params: {
  to: string;
  clinicName: string;
  adminName: string;
  /** Alias for adminName (patch compat). */
  name?: string;
  trialDays?: number;
  loginUrl?: string;
  dashboardUrl?: string;
}): Promise<void> {
  const { appUrl } = getMailConfig();
  const adminName = params.name ?? params.adminName;
  const loginUrl = params.loginUrl ?? `${appUrl}/login`;
  const dashboardUrl = params.dashboardUrl ?? `${appUrl}/dashboard`;

  const { subject, text, html } = buildWelcomeEmail({
    adminName,
    clinicName: params.clinicName,
    trialDays: params.trialDays,
    dashboardUrl,
    loginUrl,
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

/** FIX M4: Team invite email for NextAuth invite flow. */
export async function sendTeamInviteEmail(params: {
  to: string;
  inviteToken: string;
  clinicName: string;
  inviterName: string;
  role: string;
  expiresAt: Date;
}): Promise<void> {
  const { appUrl } = getMailConfig();
  const acceptUrl = `${appUrl}/invite/accept?token=${encodeURIComponent(params.inviteToken)}`;
  const { subject, text, html } = buildTeamInviteEmail({
    clinicName: params.clinicName,
    inviterName: params.inviterName,
    role: params.role,
    acceptUrl,
    expiresAt: params.expiresAt,
  });
  await sendMail({ to: params.to, subject, text, html });
}

export async function sendAppointmentReminder(params: {
  to: string;
  patientName: string;
  clinicName: string;
  appointmentDate: Date;
  appointmentTime: string;
  doctorName: string;
  confirmUrl?: string;
}): Promise<void> {
  const { subject, text, html } = buildAppointmentReminderEmail(params);
  await sendMail({ to: params.to, subject, text, html });
}

export async function sendTrialExpiryWarning(params: {
  to: string;
  clinicName: string;
  trialEndsAt: Date;
  upgradeUrl: string;
  daysRemaining: number;
}): Promise<void> {
  const { subject, text, html } = buildTrialExpiryEmail(params);
  await sendMail({ to: params.to, subject, text, html });
}
