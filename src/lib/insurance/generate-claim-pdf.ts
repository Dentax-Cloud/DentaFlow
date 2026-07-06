import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency } from "@/lib/countries";
import type { ClaimProcedureSnapshotLine } from "./claim-types";

export type ClaimPdfInput = {
  clinicName: string;
  clinicAddress?: string;
  clinicEmail?: string;
  clinicPhone?: string;
  patientName: string;
  patientId?: string;
  providerName: string;
  networkName?: string;
  memberId?: string;
  policyNumber?: string;
  claimReference: string;
  procedures: ClaimProcedureSnapshotLine[];
  submittedAmount: number;
  countryCode: string;
  generatedAt: Date;
};

export async function buildClaimPdfBytes(input: ClaimPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  let y = height - 50;

  const draw = (text: string, size = 11, bold = false) => {
    if (y < 60) return;
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
  if (input.clinicPhone) draw(`Tel: ${input.clinicPhone}`, 10);
  if (input.clinicEmail) draw(input.clinicEmail, 10);
  y -= 10;
  draw("Insurance Claim Summary", 14, true);
  draw(`Date: ${input.generatedAt.toLocaleDateString()}`);
  draw(`Claim reference: ${input.claimReference}`, 11, true);
  y -= 4;
  draw(`Patient: ${input.patientName}`);
  if (input.patientId) draw(`Patient ID: ${input.patientId}`);
  draw(`Insurer: ${input.providerName}${input.networkName ? ` · ${input.networkName}` : ""}`);
  if (input.memberId) draw(`Member ID: ${input.memberId}`);
  if (input.policyNumber) draw(`Policy / group: ${input.policyNumber}`);
  y -= 8;
  draw("Procedures", 12, true);

  for (const proc of input.procedures) {
    const code = proc.procedureCode ? `${proc.procedureCode} — ` : "";
    const qty = proc.quantity > 1 ? ` × ${proc.quantity}` : "";
    draw(
      `${code}${proc.description}${qty}: ${formatCurrency(proc.total, input.countryCode)}`,
      10,
    );
  }

  y -= 8;
  draw(
    `Submitted amount: ${formatCurrency(input.submittedAmount, input.countryCode)}`,
    12,
    true,
  );

  y -= 20;
  draw("This document is a claim summary for insurer review. Payment is not guaranteed.");

  return doc.save();
}
