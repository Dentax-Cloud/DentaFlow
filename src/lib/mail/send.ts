import { connect } from "net";
import { getMailConfig, isMailConfigured } from "./config";

export type SendMailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function extractEmail(addr: string): string {
  const match = addr.match(/<([^>]+)>/);
  return match ? match[1] : addr;
}

function buildRawMessage(from: string, params: SendMailParams): string {
  const html = params.html ?? params.text.replace(/\n/g, "<br>");
  const boundary = "dentaflow-mail-boundary";
  return [
    `From: ${from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    params.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** Minimal SMTP client for MailHog and simple relays. */
async function sendViaSmtp(
  host: string,
  port: number,
  from: string,
  params: SendMailParams,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, host);
    let buffer = "";
    let step = 0;
    const commands = [
      `EHLO dentaflow\r\n`,
      `MAIL FROM:<${extractEmail(from)}>\r\n`,
      `RCPT TO:<${params.to}>\r\n`,
      `DATA\r\n`,
      buildRawMessage(from, params),
      `.\r\n`,
      `QUIT\r\n`,
    ];

    socket.setEncoding("utf8");

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\r\n").filter(Boolean);
      const lastLine = lines[lines.length - 1] ?? "";
      if (!/^\d{3}/.test(lastLine)) return;

      const code = Number(lastLine.slice(0, 3));
      if (code >= 400) {
        socket.destroy();
        reject(new Error(`SMTP error: ${lastLine}`));
        return;
      }

      if (step < commands.length) {
        socket.write(commands[step]);
        step++;
        if (step === commands.length) {
          socket.end();
          resolve();
        }
      }
    });

    socket.on("error", reject);
  });
}

/**
 * Sends email via configured SMTP (MailHog in dev).
 * Logs to console when SMTP is not configured.
 */
export async function sendMail(params: SendMailParams): Promise<void> {
  const config = getMailConfig();

  if (!isMailConfigured()) {
    if (process.env.NODE_ENV === "development") {
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
    await sendViaSmtp(config.smtpHost!, config.smtpPort, config.from, params);
  } catch (err) {
    console.error("[mail:smtp-error]", err);
    if (process.env.NODE_ENV === "development") {
      console.info("[mail:fallback]", {
        from: config.from,
        to: params.to,
        subject: params.subject,
      });
    }
  }
}
