import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency, getCountryProfile } from "@/lib/countries";
import { INDIA_EXEMPT_SERVICE_SAC } from "@/lib/billing/india-gst";

export type InvoicePdfLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  procedureCode?: string | null;
  itemType?: string | null;
  hsnSacCode?: string | null;
  gstRate?: number | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
};

export type InvoicePdfInput = {
  clinicName: string;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  clinicEmail?: string | null;
  taxNumber?: string | null;
  invoiceNumber: string;
  invoiceRef?: string | null;
  invoiceDate: Date;
  patientName: string;
  items: InvoicePdfLineItem[];
  subtotal: number;
  tax: number;
  taxName?: string | null;
  total: number;
  currency: string;
  countryCode: string;
  isIndiaGst?: boolean;
  exemptSubtotal?: number;
  taxableSubtotal?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  insuranceAmount: number;
  patientAmount: number;
  providerCode?: string | null;
  networkType?: string | null;
  preAuthCode?: string | null;
  status: string;
  amountPaid: number;
  balanceDue: number;
  receiptPaymentAmount?: number;
  receiptPaymentMethod?: string;
  receiptPaymentDate?: Date;
};

function formatDate(date: Date, countryCode: string): string {
  const { locale } = getCountryProfile(countryCode);
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function buildInvoicePdfBytes(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  let y = height - 50;

  const draw = (text: string, size = 11, bold = false, indent = 0) => {
    if (y < 60) return;
    page.drawText(text, {
      x: 50 + indent,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= size + 6;
  };

  const money = (amount: number) => formatCurrency(amount, input.countryCode);
  const isIndia = input.isIndiaGst === true;

  draw(input.clinicName, 18, true);
  if (input.clinicAddress) draw(input.clinicAddress, 10);
  if (input.taxNumber) {
    draw(isIndia ? `GSTIN: ${input.taxNumber}` : `Tax / TRN: ${input.taxNumber}`, 10);
  }
  if (input.clinicPhone) draw(`Tel: ${input.clinicPhone}`, 10);
  if (input.clinicEmail) draw(input.clinicEmail, 10);
  y -= 8;

  const title = input.receiptPaymentAmount != null ? "Payment Receipt" : "Tax Invoice";
  draw(title, 14, true);
  draw(`Invoice #: ${input.invoiceNumber}`, 11, true);
  if (input.invoiceRef) draw(`Reference: ${input.invoiceRef}`, 10);
  draw(`Date: ${formatDate(input.invoiceDate, input.countryCode)}`);
  draw(`Patient: ${input.patientName}`);
  draw(`Status: ${input.status.replace(/_/g, " ")}`, 10);
  y -= 6;

  draw("Line items", 12, true);

  if (isIndia) {
    const services = input.items.filter((i) => i.itemType === "SERVICE" || !i.itemType);
    const goods = input.items.filter((i) => i.itemType === "GOOD");

    if (services.length > 0) {
      draw("Services (GST exempt)", 10, true);
      for (const item of services) {
        const sac = item.hsnSacCode ?? INDIA_EXEMPT_SERVICE_SAC;
        const label = item.procedureCode
          ? `${item.procedureCode} — ${item.description}`
          : item.description;
        draw(
          `${label}  SAC ${sac}  ×${item.quantity} @ ${money(item.unitPrice)} = ${money(item.total)} (exempt)`,
          9,
          false,
          8,
        );
      }
      y -= 4;
    }

    if (goods.length > 0) {
      draw("Goods (taxable)", 10, true);
      for (const item of goods) {
        const hsn = item.hsnSacCode ? `HSN ${item.hsnSacCode}` : "HSN —";
        const rate = item.gstRate != null ? `${item.gstRate}% GST` : "GST";
        draw(
          `${item.description}  ${hsn}  ${rate}  ×${item.quantity} @ ${money(item.unitPrice)} = ${money(item.total)}`,
          9,
          false,
          8,
        );
      }
    }
  } else {
    for (const item of input.items) {
      const label = item.procedureCode
        ? `${item.procedureCode} — ${item.description}`
        : item.description;
      draw(
        `${label}  ×${item.quantity} @ ${money(item.unitPrice)} = ${money(item.total)}`,
        10,
      );
    }
  }

  y -= 6;

  if (isIndia) {
    if ((input.exemptSubtotal ?? 0) > 0) {
      draw(`Exempt services subtotal: ${money(input.exemptSubtotal ?? 0)}`);
    }
    if ((input.taxableSubtotal ?? 0) > 0) {
      draw(`Taxable goods subtotal: ${money(input.taxableSubtotal ?? 0)}`);
    }
    if ((input.cgstTotal ?? 0) > 0) {
      draw(`CGST: ${money(input.cgstTotal ?? 0)}`);
    }
    if ((input.sgstTotal ?? 0) > 0) {
      draw(`SGST: ${money(input.sgstTotal ?? 0)}`);
    }
    if ((input.igstTotal ?? 0) > 0) {
      draw(`IGST: ${money(input.igstTotal ?? 0)}`);
    }
    if (input.tax > 0) {
      draw(`Total GST: ${money(input.tax)}`);
    }
  } else {
    draw(`Subtotal: ${money(input.subtotal)}`);
    if (input.tax > 0) {
      draw(`${input.taxName ?? "Tax"}: ${money(input.tax)}`);
    }
  }

  draw(`Total: ${money(input.total)}`, 12, true);

  if (input.insuranceAmount > 0 || input.providerCode) {
    y -= 4;
    draw("Insurance split", 11, true);
    if (input.providerCode) {
      draw(
        `Provider: ${input.providerCode}${input.networkType ? ` · ${input.networkType}` : ""}`,
        10,
      );
    }
    if (input.preAuthCode) draw(`Pre-auth: ${input.preAuthCode}`, 10);
    draw(`Insurer portion: ${money(input.insuranceAmount)}`, 10);
    draw(`Patient portion: ${money(input.patientAmount)}`, 10);
  }

  y -= 6;
  draw(`Amount paid: ${money(input.amountPaid)}`, 11, true);
  draw(`Balance due: ${money(input.balanceDue)}`, 11, true);

  if (input.receiptPaymentAmount != null) {
    y -= 8;
    draw("This payment", 11, true);
    draw(`Amount received: ${money(input.receiptPaymentAmount)}`, 10);
    if (input.receiptPaymentMethod) {
      draw(`Method: ${input.receiptPaymentMethod.replace(/_/g, " ")}`, 10);
    }
    if (input.receiptPaymentDate) {
      draw(`Paid on: ${formatDate(input.receiptPaymentDate, input.countryCode)}`, 10);
    }
  }

  y -= 20;
  draw(
    "Questions about this bill? Contact the clinic using the details above.",
    9,
  );
  draw("This document is a snapshot at the time of sending.", 8);

  return doc.save();
}
