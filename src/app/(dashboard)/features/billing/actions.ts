"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import { generateInvoiceNumber } from "@/lib/utils";
import { generateInvoiceRef } from "@/lib/ids/generate-ids";
import { AuditAction, InvoiceStatus, PaymentMethod } from "@prisma/client";
import { getStripeClient } from "@/lib/stripe";
import { calculateInsuranceSplit } from "@/lib/billing/insurance-calculator";
import { calculateInvoiceTaxAndLines } from "@/lib/billing/calculate-invoice-tax";
import { notifyInvoicePaid, sendInvoiceEmailToPatient, sendPaymentReceiptEmailToPatient } from "@/lib/notifications/invoice-notifications";
import { maybeCreateDraftClaimForInvoice } from "@/lib/insurance/maybe-create-draft-claim";
import { getStaffActor } from "@/lib/tenant/context";

const createInvoiceSchema = z.object({
  patientId: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().min(1),
      unitPrice: z.number().min(0),
      procedureCode: z.string().optional(),
      inventoryItemId: z.string().optional(),
      itemType: z.enum(["SERVICE", "GOOD"]).optional(),
      gstRatePercent: z.number().min(0).max(100).optional(),
      hsnCode: z.string().optional(),
    }),
  ).min(1),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  sendNow: z.boolean().optional(),
});

export const createInvoice = createAction({
  schema: createInvoiceSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const count = await db.invoice.count({ where: { tenantId: ctx.tenant.id } });
    const taxResult = await calculateInvoiceTaxAndLines({
      tenantId: ctx.tenant.id,
      patientId: input.patientId,
      items: input.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        procedureCode: item.procedureCode,
        inventoryItemId: item.inventoryItemId,
        itemType: item.itemType,
        gstRatePercent: item.gstRatePercent,
        hsnCode: item.hsnCode,
      })),
    });

    const procedureCodes = input.items
      .map((i) => i.procedureCode)
      .filter((c): c is string => Boolean(c));

    const insuranceSplit = await calculateInsuranceSplit({
      tenantId: ctx.tenant.id,
      patientId: input.patientId,
      procedureCodes,
      totalAmount: taxResult.total,
    });

    const invoice = await db.invoice.create({
      data: {
        tenantId: ctx.tenant.id,
        patientId: input.patientId,
        invoiceNumber: (await import("@/lib/utils")).generateInvoiceNumber(count + 1),
        invoiceRef: await generateInvoiceRef(ctx.tenant.id),
        status: input.sendNow ? InvoiceStatus.SENT : InvoiceStatus.DRAFT,
        subtotal: taxResult.subtotal,
        tax: taxResult.tax,
        total: taxResult.total,
        exemptSubtotal: taxResult.exemptSubtotal,
        taxableSubtotal: taxResult.taxableSubtotal,
        cgstTotal: taxResult.cgstTotal,
        sgstTotal: taxResult.sgstTotal,
        igstTotal: taxResult.igstTotal,
        currency: taxResult.currency,
        taxName: taxResult.taxName,
        taxRateApplied: taxResult.taxRateApplied,
        taxNumber: taxResult.taxNumber,
        insuranceAmount: insuranceSplit?.insurerAmount ?? 0,
        patientAmount: insuranceSplit?.patientAmount ?? taxResult.total,
        coPayPercent: insuranceSplit?.coPayPercent ?? null,
        providerCode: insuranceSplit?.providerName ?? null,
        networkType: insuranceSplit?.networkName ?? null,
        preAuthCode: insuranceSplit?.preAuthReference ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        notes: input.notes,
        items: {
          create: taxResult.lines.map((line) => ({
            tenantId: ctx.tenant.id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: line.total,
            procedureCode: line.procedureCode,
            inventoryItemId: line.inventoryItemId,
            itemType: line.itemType,
            hsnSacCode: line.hsnSacCode,
            gstRate: line.gstRate,
            cgstAmount: line.cgstAmount,
            sgstAmount: line.sgstAmount,
            igstAmount: line.igstAmount,
          })),
        },
      },
      include: { items: true, patient: true },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.CREATE,
      entity: "Invoice",
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, total: Number(invoice.total) },
    });

    if (input.sendNow) {
      await sendInvoiceEmailToPatient({
        tenantId: ctx.tenant.id,
        invoiceId: invoice.id,
      }).catch(() => null);
    }

    await maybeCreateDraftClaimForInvoice({
      tenantId: ctx.tenant.id,
      invoiceId: invoice.id,
    }).catch(() => null);

    return invoice;
  },
});

const recordPaymentSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
});

export const recordPayment = createAction({
  schema: recordPaymentSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const invoice = await db.invoice.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.invoiceId }),
      include: { payments: true },
    });
    if (!invoice) throw new Error("Invoice not found");

    const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0) + input.amount;
    const total = Number(invoice.total);

    const payment = await db.payment.create({
      data: {
        tenantId: ctx.tenant.id,
        invoiceId: input.invoiceId,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
      },
    });

    const newStatus =
      paid >= total
        ? InvoiceStatus.PAID
        : paid > 0
          ? InvoiceStatus.PARTIAL
          : invoice.status;

    await db.invoice.update({
      where: { id: input.invoiceId },
      data: { status: newStatus },
    });

    if (newStatus === InvoiceStatus.PAID) {
      await notifyInvoicePaid({
        tenantId: ctx.tenant.id,
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        amount: total,
      }).catch(() => null);
    }

    await sendPaymentReceiptEmailToPatient({
      tenantId: ctx.tenant.id,
      invoiceId: invoice.id,
      paymentId: payment.id,
    }).catch(() => null);

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.CREATE,
      entity: "Payment",
      entityId: payment.id,
      metadata: { invoiceId: input.invoiceId, amount: input.amount, method: input.method },
    });

    return payment;
  },
});

export const markInvoiceSent = createAction({
  schema: z.object({ invoiceId: z.string() }),
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const invoice = await db.invoice.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.invoiceId }),
    });
    if (!invoice) throw new Error("Invoice not found");

    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.SENT },
    });

    if (!invoice.emailedAt) {
      await sendInvoiceEmailToPatient({
        tenantId: ctx.tenant.id,
        invoiceId: invoice.id,
      }).catch(() => null);
    }

    return updated;
  },
});

export async function createStripePaymentLink(tenantId: string, invoiceId: string) {
  const invoice = await db.invoice.findFirst({
    where: tenantWhere(tenantId, { id: invoiceId }),
    include: { patient: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  const stripe = await getStripeClient();
  if (!stripe) throw new Error("Stripe not configured");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Invoice ${invoice.invoiceNumber}` },
          unit_amount: Math.round(Number(invoice.total) * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "clinic_invoice",
      tenantId,
      invoiceId,
    },
    payment_intent_data: {
      metadata: {
        type: "clinic_invoice",
        tenantId,
        invoiceId,
      },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?paid=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return session.url;
}

export async function getInvoices(tenantId: string, status?: InvoiceStatus) {
  return db.invoice.findMany({
    where: { tenantId, deletedAt: null, ...(status ? { status } : {}) },
    include: { patient: true, payments: true, items: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getProcedureCatalog(tenantId: string) {
  return db.procedureCatalog.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
  });
}
