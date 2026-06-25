type GS1Data = {
  gtin?: string;
  expiryDate?: Date;
  lotNumber?: string;
  quantity?: number;
  serialNumber?: string;
  raw: string;
};

const AI_MAP: Record<string, { field: keyof GS1Data; length?: number }> = {
  "01": { field: "gtin", length: 14 },
  "17": { field: "expiryDate", length: 6 },
  "10": { field: "lotNumber" },
  "37": { field: "quantity" },
  "21": { field: "serialNumber" },
};

export function parseGS1(barcode: string): GS1Data {
  const result: GS1Data = { raw: barcode };
  let pos = 0;

  const clean = barcode.replace(/\u001d/g, "");

  while (pos < clean.length) {
    let matched = false;
    for (const aiLen of [2, 3, 4]) {
      const ai = clean.substring(pos, pos + aiLen);
      if (AI_MAP[ai]) {
        pos += aiLen;
        const mapping = AI_MAP[ai];
        const valueLen = mapping.length;
        const value = valueLen
          ? clean.substring(pos, pos + valueLen)
          : clean.substring(pos).split("\u001d")[0];

        if (ai === "01" && value) {
          result.gtin = value;
        } else if (ai === "17" && value.length === 6) {
          const yr = parseInt(value.substring(0, 2));
          const mo = parseInt(value.substring(2, 4)) - 1;
          const dy = parseInt(value.substring(4, 6)) || 28;
          result.expiryDate = new Date(2000 + yr, mo, dy);
        } else if (ai === "10") {
          result.lotNumber = value;
        } else if (ai === "37") {
          result.quantity = parseInt(value);
        } else if (ai === "21") {
          result.serialNumber = value;
        }

        pos += valueLen ?? value.length;
        matched = true;
        break;
      }
    }
    if (!matched) break;
  }

  return result;
}

export function detectBarcodeType(barcode: string): string {
  const clean = barcode.trim();
  if (/^\d{13}$/.test(clean)) return "EAN13";
  if (/^\d{8}$/.test(clean)) return "EAN8";
  if (/^\d{12}$/.test(clean)) return "UPCA";
  if (/^\(0[0-9]\)/.test(clean) || clean.includes("\u001d")) return "GS1_128";
  if (clean.startsWith("PAT-")) return "PATIENT_ID";
  if (clean.startsWith("APT-")) return "APPOINTMENT_ID";
  if (clean.startsWith("INV-")) return "INVOICE_ID";
  if (clean.startsWith("ITM-")) return "INVENTORY_ITEM";
  if (clean.startsWith("BTH-")) return "INVENTORY_BATCH";
  return "CODE128";
}
