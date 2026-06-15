import { TRIAL_DURATION_DAYS } from "@/lib/tenant/trial";
import { emailButton, emailLayout } from "./layout";

export type WelcomeEmailData = {
  adminName: string;
  clinicName: string;
  trialDays?: number;
  dashboardUrl: string;
};

export function buildWelcomeEmail(data: WelcomeEmailData): { subject: string; text: string; html: string } {
  const trialDays = data.trialDays ?? TRIAL_DURATION_DAYS;
  const subject = `Welcome to DentaFlow — ${data.clinicName} is ready`;

  const text = [
    `Hi ${data.adminName},`,
    "",
    `Welcome to DentaFlow! ${data.clinicName} is now set up on our platform.`,
    "",
    `Your ${trialDays}-day free trial on the STARTER plan is active. You can:`,
    "• Add patients and schedule appointments",
    "• Configure operatories and clinical workflows",
    "• Explore billing, reports, and AI features",
    "",
    `Open your dashboard: ${data.dashboardUrl}`,
    "",
    "— The DentaFlow Team",
  ].join("\n");

  const html = emailLayout(`
    <p style="margin:0 0 16px;color:#fafafa;font-size:20px;font-weight:600;">Welcome, ${data.adminName}!</p>
    <p style="margin:0 0 16px;"><strong style="color:#fafafa;">${data.clinicName}</strong> is ready on DentaFlow.</p>
    <p style="margin:0 0 16px;">Your <strong style="color:#38bdf8;">${trialDays}-day free trial</strong> on the STARTER plan is now active.</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#a1a1aa;">
      <li>Add patients and schedule appointments</li>
      <li>Configure operatories and clinical workflows</li>
      <li>Explore billing, reports, and AI features</li>
    </ul>
    ${emailButton(data.dashboardUrl, "Open your dashboard")}
    <p style="margin:0;color:#71717a;font-size:13px;">No credit card required during your trial.</p>
  `);

  return { subject, text, html };
}
