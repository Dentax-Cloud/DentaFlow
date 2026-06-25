export function toBarcodeValue(id: string): string {
  return id.replace(/-/g, "").toUpperCase();
}

export function buildQrPayload(data: {
  patientId: string;
  patientName: string;
  tenantCode: string;
  branchCode: string;
  bloodGroup?: string | null;
  criticalAllergy?: string | null;
}): string {
  return JSON.stringify({
    t: "DF_PT",
    id: data.patientId,
    n: data.patientName,
    tc: data.tenantCode,
    bc: data.branchCode,
    bg: data.bloodGroup ?? null,
    al: data.criticalAllergy ?? null,
    v: 1,
  });
}

export const LABEL_SIZES = {
  card: { width: 342, height: 216, name: "ID Card (credit card)" },
  standard: { width: 248, height: 116, name: "Standard label" },
  wristband: { width: 560, height: 100, name: "Wristband" },
  small: { width: 152, height: 76, name: "Small sticker" },
};
