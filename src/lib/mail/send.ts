import type { Transporter } from "nodemailer";
import { getSetting } from "@/lib/settings/platform-settings";

export type SendMailParams = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export async function getMailTransporter(): Promise<Transporter | null> {
  const [host, port, user, pass, enabled] = await Promise.all([
    getSetting("SMTP_HOST"),
    getSetting("SMTP_PORT"),
    getSetting("SMTP_USER"),
    getSetting("SMTP_PASSWORD"),
    getSetting("EMAIL_ENABLED"),
  ]);

  if (!host || enabled === "false") {
    const devHost = process.env.MAILHOG_HOST ?? "mailhog";
    if (process.env.NODE_ENV === "development" || process.env.USE_MAILHOG === "true") {
      const nodemailer = (await import("nodemailer")).default;
      return nodemailer.createTransport({
        host: devHost,
        port: 1025,
        secure: false,
        ignoreTLS: true,
      });
    }
    return null;
  }

  const nodemailer = (await import("nodemailer")).default;
  const portNum = parseInt(port ?? "587", 10);
  return nodemailer.createTransport({
    host,
    port: portNum,
    secure: portNum === 465,
    auth: user && pass ? { user, pass } : undefined,
    tls: { rejectUnauthorized: false },
  });
}

export async function sendMail(params: SendMailParams): Promise<boolean> {
  const transporter = await getMailTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[mail:fallback]", {
        to: params.to,
        subject: params.subject,
        text: params.text,
      });
    } else {
      console.log(`[Mail] Not configured — skipping: "${params.subject}"`);
    }
    return false;
  }

  const [fromName, fromEmail] = await Promise.all([
    getSetting("SMTP_FROM_NAME"),
    getSetting("SMTP_FROM_EMAIL"),
  ]);

  const to = Array.isArray(params.to) ? params.to.join(", ") : params.to;
  const from =
    fromEmail != null
      ? `"${fromName ?? "DentaFlow"}" <${fromEmail}>`
      : process.env.SMTP_FROM?.trim() || "DentaFlow <no-reply@dentaflow.app>";

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: params.subject,
      text: params.text,
      html: params.html ?? params.text.replace(/\n/g, "<br>"),
    });
    console.log(`[mail] sent "${params.subject}" to ${to}`, info.messageId);
    return true;
  } catch (err) {
    console.error(`[mail] failed "${params.subject}" to ${to}:`, err);
    if (process.env.NODE_ENV === "development") {
      console.info("[mail:fallback]", { to, subject: params.subject, text: params.text });
      return false;
    }
    throw err;
  }
}
