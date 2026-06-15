export type MailConfig = {
  from: string;
  smtpHost?: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure: boolean;
  appUrl: string;
};

export function getMailConfig(): MailConfig {
  const port = Number(process.env.SMTP_PORT ?? "1025");
  return {
    from: process.env.SMTP_FROM?.trim() || "DentaFlow <no-reply@dentaflow.app>",
    smtpHost: process.env.SMTP_HOST?.trim() || undefined,
    smtpPort: port,
    smtpUser: process.env.SMTP_USER?.trim() || undefined,
    smtpPassword: process.env.SMTP_PASSWORD?.trim() || undefined,
    smtpSecure: process.env.SMTP_SECURE === "true" || port === 465,
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
  };
}

export function isMailConfigured(): boolean {
  return Boolean(getMailConfig().smtpHost);
}
