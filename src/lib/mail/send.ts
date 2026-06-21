import type { Transporter } from "nodemailer";
import { getMailConfig, isMailConfigured } from "./config";

export type SendMailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let cachedTransport: Transporter | null = null;

function createTransport(): Transporter | null {
  let nodemailer: typeof import("nodemailer") | null = null;
  try {
    nodemailer = require("nodemailer");
  } catch {
    return null;
  }

  const config = getMailConfig();
  return nodemailer.createTransport({
    host: config.smtpHost ?? "localhost",
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth:
      config.smtpUser && config.smtpPassword
        ? { user: config.smtpUser, pass: config.smtpPassword }
        : undefined,
  });
}

function getTransport(): Transporter | null {
  if (!cachedTransport) {
    cachedTransport = createTransport();
  }
  return cachedTransport;
}

/**
 * Sends email via configured SMTP (MailHog in dev, SendGrid/Postmark in prod).
 * Logs to console when SMTP is not configured or nodemailer is unavailable.
 */
export async function sendMail(params: SendMailParams): Promise<void> {
  const config = getMailConfig();

  const transport = getTransport();

  if (!transport || !isMailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[mail:fallback]", {
        from: config.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
      });
    }
    return;
  }

  try {
    const info = await transport.sendMail({
      from: config.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html ?? params.text.replace(/\n/g, "<br>"),
    });
    console.log(`[mail] sent "${params.subject}" to ${params.to}`, info.messageId);
  } catch (err) {
    console.error(`[mail] failed "${params.subject}" to ${params.to}:`, err);
    if (process.env.NODE_ENV === "development") {
      console.info("[mail:fallback]", {
        from: config.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
      });
      return;
    }
    throw err;
  }
}
