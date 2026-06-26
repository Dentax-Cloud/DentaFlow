export type MailConfig = {
  from: string;
  smtpHost?: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure: boolean;
  appUrl: string;
};

/** @deprecated Prefer async getMailTransporter from ./send */
export function getMailConfig(): MailConfig {
  const port = Number(process.env.SMTP_PORT ?? "1025");
  const appUrl =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  return {
    from: process.env.SMTP_FROM?.trim() || "DentaFlow <no-reply@dentaflow.app>",
    smtpHost: process.env.SMTP_HOST?.trim() || undefined,
    smtpPort: port,
    smtpUser: process.env.SMTP_USER?.trim() || undefined,
    smtpPassword:
      process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim() || undefined,
    smtpSecure: process.env.SMTP_SECURE === "true" || port === 465,
    appUrl,
  };
}

export async function isMailConfigured(): Promise<boolean> {
  const { getSetting } = await import("@/lib/settings/platform-settings");
  const [host, enabled] = await Promise.all([
    getSetting("SMTP_HOST"),
    getSetting("EMAIL_ENABLED"),
  ]);
  if (host && enabled !== "false") return true;
  return Boolean(getMailConfig().smtpHost);
}
