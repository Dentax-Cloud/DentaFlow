import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency } from "@/lib/countries";
import type { ProcedureCodeSnapshot } from "./estimate-types";

export type EstimatePdfInput = {
  clinicName: string;
  clinicAddress?: string;
  patientName: string;
  providerName?: string;
  networkName?: string;
  procedures: ProcedureCodeSnapshot[];
  totalAmount: number;
  insurerAmount: number;
  patientAmount: number;
  countryCode: string;
  generatedAt: Date;
};

export async function buildEstimatePdfBytes(input: EstimatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  let y = height - 50;

  const draw = (text: string, size = 11, bold = false) => {
    page.drawText(text, {
      x: 50,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= size + 6;
  };

  draw(input.clinicName, 18, true);
  if (input.clinicAddress) draw(input.clinicAddress, 10);
  y -= 10;
  draw("Treatment Cost Estimate", 14, true);
  draw(`Date: ${input.generatedAt.toLocaleDateString()}`);
  draw(`Patient: ${input.patientName}`);
  if (input.providerName) {
    draw(`Insurance: ${input.providerName}${input.networkName ? ` · ${input.networkName}` : ""}`);
  } else {
    draw("Payment: Self-pay");
  }
  y -= 8;
  draw("Procedures", 12, true);

  for (const proc of input.procedures) {
    const line = proc.code
      ? `${proc.code} — ${proc.description}`
      : proc.description;
    draw(`${line}: ${formatCurrency(proc.amount, input.countryCode)}`, 10);
  }

  y -= 8;
  draw(
    `Total estimate: ${formatCurrency(input.totalAmount, input.countryCode)}`,
    12,
    true,
  );
  draw(`Insurer portion: ${formatCurrency(input.insurerAmount, input.countryCode)}`);
  draw(`Patient portion: ${formatCurrency(input.patientAmount, input.countryCode)}`);

  y -= 30;
  draw("Patient signature: ___________________________    Date: __________");
  draw("This estimate is not a guarantee of insurance payment.");

  return doc.save();
}
