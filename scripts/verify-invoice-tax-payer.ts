/**
 * Verification helper for invoice tax + payer-type consolidation.
 * Run against a DB with: pnpm exec tsx scripts/verify-invoice-tax-payer.ts
 *
 * Creates two invoices via createInvoiceFromItems (self-pay patient + insured patient)
 * and one via the treatment-plan path helpers when PLAN_ID is set.
 */
import { PrismaClient, PolicyRank } from "@prisma/client";
import { createInvoiceFromItems } from "../src/lib/billing/invoice-from-items";
import { getTenantInvoiceTax } from "../src/lib/billing/tenant-invoice-tax";
import { calculateInvoiceTaxAndLines } from "../src/lib/billing/calculate-invoice-tax";

const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.findFirst({
    where: { deletedAt: null, subscriptionStatus: { in: ["ACTIVE", "TRIALING"] } },
    orderBy: { createdAt: "asc" },
  });
  if (!tenant) throw new Error("No tenant found");

  const tax = await getTenantInvoiceTax(tenant.id);
  console.log("tenant_tax", {
    tenantId: tenant.id,
    slug: tenant.slug,
    taxName: tax.taxName,
    taxRatePercent: tax.taxRatePercent,
  });

  const selfPayPatient = await db.patient.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [
        { insuranceProvider: null },
        { insuranceProvider: "SELF_PAY" },
        { insuranceProvider: "" },
      ],
      patientInsurancePolicies: { none: { isActive: true, rank: PolicyRank.PRIMARY } },
    },
  });

  const insuredPatient = await db.patient.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      patientInsurancePolicies: {
        some: { isActive: true, rank: PolicyRank.PRIMARY },
      },
    },
  });

  if (!selfPayPatient) throw new Error("No self-pay patient found");
  if (!insuredPatient) throw new Error("No insured patient with primary policy found");

  const items = [
    {
      description: "Verification prophylaxis",
      quantity: 1,
      unitPrice: 100,
      total: 100,
      procedureCode: "D1110",
    },
  ];

  const taxViaBilling = await calculateInvoiceTaxAndLines({
    tenantId: tenant.id,
    patientId: selfPayPatient.id,
    items,
  });
  console.log("tax_path_billing_createInvoiceFromItems", {
    taxRateApplied: taxViaBilling.taxRateApplied,
    tax: taxViaBilling.tax,
    total: taxViaBilling.total,
  });

  const selfPayInv = await createInvoiceFromItems({
    tenantId: tenant.id,
    patientId: selfPayPatient.id,
    items,
    notes: "verify-invoice-tax-payer self-pay",
    status: "DRAFT",
  });

  const insuredInv = await createInvoiceFromItems({
    tenantId: tenant.id,
    patientId: insuredPatient.id,
    items,
    notes: "verify-invoice-tax-payer insurance",
    status: "DRAFT",
  });

  const rows = await db.invoice.findMany({
    where: { id: { in: [selfPayInv.id, insuredInv.id] } },
    select: {
      id: true,
      invoiceNumber: true,
      payerType: true,
      tax: true,
      taxRateApplied: true,
      taxName: true,
      total: true,
      insuranceAmount: true,
      patientAmount: true,
      coPayPercent: true,
      notes: true,
    },
  });
  console.log("created_invoices", JSON.stringify(rows, null, 2));

  const plan = await db.treatmentPlan.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      patientId: insuredPatient.id,
      items: { some: { NOT: { status: { in: ["declined", "DECLINED"] } } } },
    },
    include: {
      items: {
        where: { NOT: { status: { in: ["declined", "DECLINED"] } } },
        take: 3,
      },
    },
  });

  if (plan && plan.items.length > 0) {
    // Inline the same math as generateInvoiceFromPlan (without auth) for DB evidence.
    const { calculateInsuranceSplit } = await import(
      "../src/lib/billing/insurance-calculator"
    );
    const { resolveInvoicePayerType } = await import(
      "../src/lib/billing/invoice-payer-type"
    );
    const { generateInvoiceNumber } = await import("../src/lib/utils");

    const planTax = await calculateInvoiceTaxAndLines({
      tenantId: tenant.id,
      patientId: plan.patientId,
      items: plan.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitCost),
        procedureCode: item.procedureCode ?? undefined,
      })),
    });
    const procedureCodes = plan.items
      .map((i) => i.procedureCode)
      .filter((c): c is string => Boolean(c));
    const split = await calculateInsuranceSplit({
      tenantId: tenant.id,
      patientId: plan.patientId,
      procedureCodes,
      totalAmount: planTax.total,
    });
    const count = await db.invoice.count({ where: { tenantId: tenant.id } });
    const planInv = await db.invoice.create({
      data: {
        tenantId: tenant.id,
        patientId: plan.patientId,
        invoiceNumber: generateInvoiceNumber(count + 1),
        status: "DRAFT",
        payerType: resolveInvoicePayerType(split),
        subtotal: planTax.subtotal,
        tax: planTax.tax,
        total: planTax.total,
        taxRateApplied: planTax.taxRateApplied,
        taxName: planTax.taxName,
        currency: planTax.currency,
        insuranceAmount: split?.insurerAmount ?? 0,
        patientAmount: split?.patientAmount ?? planTax.total,
        coPayPercent: split?.coPayPercent ?? null,
        notes: `verify-invoice-tax-payer plan ${plan.id}`,
        items: {
          create: planTax.lines.map((line) => ({
            tenantId: tenant.id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: line.total,
            procedureCode: line.procedureCode,
            itemType: line.itemType,
          })),
        },
      },
    });
    console.log("plan_invoice", {
      id: planInv.id,
      invoiceNumber: planInv.invoiceNumber,
      payerType: planInv.payerType,
      taxRateApplied: planInv.taxRateApplied?.toString(),
      tax: planInv.tax.toString(),
      insuranceAmount: planInv.insuranceAmount?.toString(),
      patientAmount: planInv.patientAmount?.toString(),
      coPayPercent: planInv.coPayPercent?.toString(),
    });
    console.log("tax_rate_match", {
      tenantTaxRate: tax.taxRatePercent,
      billingInvoiceTaxRate: Number(selfPayInv.taxRateApplied ?? 0),
      planInvoiceTaxRate: Number(planInv.taxRateApplied ?? 0),
      match:
        Number(selfPayInv.taxRateApplied ?? 0) === tax.taxRatePercent &&
        Number(planInv.taxRateApplied ?? 0) === tax.taxRatePercent,
    });
  } else {
    console.log("plan_invoice_skipped", "no treatment plan with items for insured patient");
    console.log("tax_rate_match", {
      tenantTaxRate: tax.taxRatePercent,
      billingInvoiceTaxRate: Number(selfPayInv.taxRateApplied ?? 0),
      match: Number(selfPayInv.taxRateApplied ?? 0) === tax.taxRatePercent,
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
