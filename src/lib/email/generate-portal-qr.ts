import QRCode from "qrcode";

export async function generatePortalQR(
  portalUrl: string,
  patientId: string,
  tenantSlug: string,
): Promise<string> {
  const payload = JSON.stringify({
    type: "DF_PATIENT_PORTAL",
    portal: portalUrl,
    patientId,
    slug: tenantSlug,
  });

  const dataUrl = await QRCode.toDataURL(payload, {
    width: 200,
    margin: 2,
    color: { dark: "#1a1a1a", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });

  return dataUrl.split(",")[1] ?? "";
}

export function getPortalRegistrationHint(countryCode: string): string {
  const hints: Record<string, string> = {
    AE: "Register using your Emirates ID or Date of Birth",
    SA: "Register using your National ID (Iqama) or Date of Birth",
    QA: "Register using your QID or Date of Birth",
    BH: "Register using your CPR Number or Date of Birth",
    KW: "Register using your Civil ID or Date of Birth",
    OM: "Register using your National ID or Date of Birth",
    GB: "Register using your NHS Number or Date of Birth",
    US: "Register using your Insurance Member ID or Date of Birth",
    IN: "Register using your Aadhaar or Date of Birth",
    SG: "Register using your NRIC or Date of Birth",
    AU: "Register using your Medicare Number or Date of Birth",
  };
  return hints[countryCode] ?? "Register using your Date of Birth and full name";
}
