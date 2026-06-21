"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import { generateInvoiceNumber } from "@/lib/utils";
import { AuditAction, InvoiceStatus, PaymentMethod } from "@prisma/client";
import { stripe } from "@/lib/stripe";

const createInvoiceSchema = z.object({
  patientId: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().min(1),
      unitPrice: z.number().min(0),
      procedureCode: z.string().optional(),
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
    const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const settings = await db.settings.findUnique({ where: { tenantId: ctx.tenant.id } });
    const taxRate = settings?.taxRate ?? 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    const invoice = await db.invoice.create({
      data: {
        tenantId: ctx.tenant.id,
        patientId: input.patientId,
        invoiceNumber: generateInvoiceNumber(count + 1),
        status: input.sendNow ? InvoiceStatus.SENT : InvoiceStatus.DRAFT,
        subtotal,
        tax,
        total,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        notes: input.notes,
        items: {
          create: input.items.map((item) => ({
            tenantId: ctx.tenant.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            procedureCode: item.procedureCode,
          })),
        },
      },
      include: { items: true, patient: true },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: AuditAction.CREATE,
      entity: "Invoice",
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, total: Number(invoice.total) },
    });

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

    await db.invoice.update({
      where: { id: input.invoiceId },
      data: {
        status:
          paid >= total
            ? InvoiceStatus.PAID
            : paid > 0
              ? InvoiceStatus.PARTIAL
              : invoice.status,
      },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
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

    return db.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.SENT },
    });
  },
});

export async function createStripePaymentLink(tenantId: string, invoiceId: string) {
  const invoice = await db.invoice.findFirst({
    where: tenantWhere(tenantId, { id: invoiceId }),
    include: { patient: true },
  });
  if (!invoice) throw new Error("Invoice not found");

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
