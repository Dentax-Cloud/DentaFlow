import { emailButton, emailLayout } from "./layout";

export type TeamInviteEmailData = {
  clinicName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
};

export function buildTeamInviteEmail(data: TeamInviteEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const roleLabel = data.role.toLowerCase();
  const subject = `You're invited to join ${data.clinicName} on DentaFlow`;

  const text = [
    `${data.inviterName} has invited you to join ${data.clinicName} as a ${roleLabel} on DentaFlow.`,
    "",
    `Accept invitation: ${data.acceptUrl}`,
    "",
    `This invitation expires on ${data.expiresAt.toLocaleDateString()}.`,
  ].join("\n");

  const html = emailLayout(`
    <p style="margin:0 0 16px;color:#fafafa;font-size:20px;font-weight:600;">You're invited!</p>
    <p style="margin:0 0 16px;">
      <strong style="color:#fafafa;">${data.inviterName}</strong> has invited you to join
      <strong style="color:#fafafa;">${data.clinicName}</strong> as a
      <strong style="color:#38bdf8;">${roleLabel}</strong> on DentaFlow.
    </p>
    ${emailButton(data.acceptUrl, "Accept invitation")}
    <p style="margin:0;color:#71717a;font-size:13px;">
      This invitation expires on ${data.expiresAt.toLocaleDateString()}.
      If you weren't expecting this, you can ignore this email.
    </p>
  `);

  return { subject, text, html };
}
