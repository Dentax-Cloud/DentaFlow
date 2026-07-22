/**
 * Force a CO_PAY invoice: insured patient with nonzero co-pay percent,
 * then createInvoiceFromItems and print the resulting row.
 */
import { PrismaClient, PolicyRank } from "@prisma/client";
import { createInvoiceFromItems } from "../src/lib/billing/invoice-from-items";
import { calculateInsuranceSplit } from "../src/lib/billing/insurance-calculator";
import { resolveInvoicePayerType } from "../src/lib/billing/invoice-payer-type";

const db = new PrismaClient();

async function main() {
  const insured = await db.patient.findFirst({
    where: {
      deletedAt: null,
      patientInsurancePolicies: {
        some: { isActive: true, rank: PolicyRank.PRIMARY },
      },
      tenant: { deletedAt: null },
    },
    include: {
      tenant: true,
      patientInsurancePolicies: {
        where: { isActive: true, rank: PolicyRank.PRIMARY },
        take: 1,
        include: { provider: true },
      },
    },
  });
  if (!insured) throw new Error("No insured patient found");

  const previousCoPay = insured.insuranceCoPayPercent;
  // Ensure co-pay path: 20% patient responsibility → both amounts nonzero
  await db.patient.update({
    where: { id: insured.id },
    data: { insuranceCoPayPercent: 20 },
  });

  try {
    const items = [
      {
        description: "CO_PAY verification cleaning",
        quantity: 1,
        unitPrice: 200,
        total: 200,
        procedureCode: "D1110",
      },
    ];

    const preview = await calculateInsuranceSplit({
      tenantId: insured.tenantId,
      patientId: insured.id,
      procedureCodes: ["D1110"],
      totalAmount: 200, // pre-tax; createInvoiceFromItems taxes then splits on taxed total
    });
    console.log("split_preview_pretax", preview);
    console.log(
      "resolve_preview",
      resolveInvoicePayerType(preview),
      "logic=",
      "insurer>0 && patient<=0.000001 → INSURANCE; insurer>0 && patient>0 → CO_PAY",
    );

    const inv = await createInvoiceFromItems({
      tenantId: insured.tenantId,
      patientId: insured.id,
      items,
      notes: "verify-invoice-copay",
      status: "DRAFT",
    });

    const row = await db.invoice.findUnique({
      where: { id: inv.id },
      select: {
        invoiceNumber: true,
        payerType: true,
        insuranceAmount: true,
        patientAmount: true,
        coPayPercent: true,
        total: true,
        tax: true,
      },
    });
    console.log("copay_invoice_row", JSON.stringify(row, (_, v) =>
      typeof v === "object" && v !== null && "toFixed" in v ? String(v) : v,
    null, 2));

    if (row?.payerType !== "CO_PAY") {
      throw new Error(
        `Expected CO_PAY, got ${row?.payerType} (ins=${row?.insuranceAmount} pat=${row?.patientAmount})`,
      );
    }
    console.log("PASS: payerType=CO_PAY");
  } finally {
    await db.patient.update({
      where: { id: insured.id },
      data: { insuranceCoPayPercent: previousCoPay },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
