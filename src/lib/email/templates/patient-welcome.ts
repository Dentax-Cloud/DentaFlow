import { generatePortalQR, getPortalRegistrationHint } from "@/lib/email/generate-portal-qr";

type PatientWelcomeInput = {
  patientName: string;
  patientId: string;
  clinicName: string;
  clinicPhone?: string;
  clinicLogoUrl?: string;
  portalEnabled: boolean;
  portalUrl: string;
  tenantSlug: string;
  countryCode: string;
};

export async function buildPatientWelcomeEmail(
  input: PatientWelcomeInput,
): Promise<{ subject: string; text: string; html: string }> {
  const subject = `Welcome to ${input.clinicName} — Your Patient Account`;

  let qrBase64: string | null = null;
  if (input.portalEnabled) {
    try {
      qrBase64 = await generatePortalQR(
        input.portalUrl,
        input.patientId,
        input.tenantSlug,
      );
    } catch {
      qrBase64 = null;
    }
  }

  const registrationHint = getPortalRegistrationHint(input.countryCode);

  const text = [
    `Welcome to ${input.clinicName}!`,
    "",
    `Dear ${input.patientName},`,
    "",
    `You have been registered as a patient at ${input.clinicName}.`,
    "",
    `YOUR PATIENT ID: ${input.patientId}`,
    "Please keep this ID for your records.",
    ...(input.portalEnabled
      ? [
          "",
          "PATIENT PORTAL ACCESS",
          "Access your appointments, records and invoices online:",
          input.portalUrl,
          "",
          registrationHint,
        ]
      : []),
    "",
    "If you have questions, please contact us:",
    ...(input.clinicPhone ? [`Phone: ${input.clinicPhone}`] : []),
    "",
    `Thank you for choosing ${input.clinicName}.`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#0ea5e9,#0284c7);padding:32px 24px;text-align:center">
      ${
        input.clinicLogoUrl
          ? `<img src="${input.clinicLogoUrl}" alt="${input.clinicName}" style="height:48px;object-fit:contain;margin-bottom:16px">`
          : `<h1 style="color:white;margin:0 0 8px;font-size:24px">${input.clinicName}</h1>`
      }
      <p style="color:rgba(255,255,255,0.85);margin:0;font-size:14px">Patient Portal</p>
    </div>
    <div style="padding:32px 24px">
      <h2 style="margin:0 0 8px;color:#111;font-size:20px">Welcome, ${input.patientName}!</h2>
      <p style="color:#555;margin:0 0 24px;line-height:1.6">
        You have been registered as a patient at <strong>${input.clinicName}</strong>.
      </p>
      <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center">
        <p style="color:#64748b;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600">Your Patient ID</p>
        <p style="color:#0ea5e9;margin:0;font-size:18px;font-family:monospace;font-weight:700;letter-spacing:1px">${input.patientId}</p>
        <p style="color:#94a3b8;margin:8px 0 0;font-size:11px">Keep this ID for all clinic visits</p>
      </div>
      ${
        input.portalEnabled && qrBase64
          ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:24px;margin-bottom:24px">
        <h3 style="color:#1e40af;margin:0 0 8px;font-size:16px">Patient Portal Access</h3>
        <p style="color:#3b82f6;margin:0 0 16px;font-size:13px;line-height:1.5">
          Access your appointments, invoices, consent forms and health records online.
        </p>
        <div style="text-align:center;margin:16px 0">
          <img src="data:image/png;base64,${qrBase64}" alt="Portal QR Code"
            style="width:150px;height:150px;border:8px solid white;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
          <p style="color:#64748b;margin:8px 0 0;font-size:11px">Scan to open portal</p>
        </div>
        <div style="text-align:center;margin-top:12px">
          <p style="color:#64748b;margin:0 0 4px;font-size:12px">Or visit:</p>
          <a href="${input.portalUrl}" style="color:#0ea5e9;font-weight:600;font-size:14px">${input.portalUrl}</a>
        </div>
        <div style="background:#dbeafe;border-radius:8px;padding:12px;margin-top:16px">
          <p style="color:#1e40af;margin:0;font-size:12px;line-height:1.5">
            <strong>First time?</strong> ${registrationHint}
          </p>
        </div>
      </div>`
          : input.portalEnabled
            ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#1e40af;margin:0 0 8px;font-size:14px;font-weight:600">Patient Portal</p>
        <a href="${input.portalUrl}" style="color:#0ea5e9;word-break:break-all">${input.portalUrl}</a>
        <p style="color:#64748b;margin:8px 0 0;font-size:12px">${registrationHint}</p>
      </div>`
            : ""
      }
      ${
        input.clinicPhone
          ? `<div style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center">
        <p style="color:#64748b;margin:0;font-size:13px">Questions? Contact us at</p>
        <p style="color:#0ea5e9;font-weight:600;margin:4px 0 0;font-size:16px">${input.clinicPhone}</p>
      </div>`
          : ""
      }
    </div>
    <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="color:#94a3b8;margin:0;font-size:11px">${input.clinicName} · Powered by DentaFlow</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
