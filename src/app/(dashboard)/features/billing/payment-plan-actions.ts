"use server";

import { randomUUID } from "crypto";
import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { serializeDecimal } from "@/lib/utils/serialize";

export async function createPaymentPlan(input: {
  patientId: string;
  invoiceId?: string;
  totalAmount: number;
  installments: number;
  frequency?: string;
  startDate: string;
  notes?: string;
}) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.billing.write);

  const patient = await db.patient.findFirst({
    where: { id: input.patientId, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!patient) throw new Error("Patient not found");

  const installmentAmount = input.totalAmount / input.installments;
  const startDate = new Date(input.startDate);

  const plan = await db.paymentPlan.create({
    data: {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      invoiceId: input.invoiceId ?? null,
      planRef: `PLN-${Date.now()}`,
      totalAmount: input.totalAmount,
      installments: input.installments,
      frequency: input.frequency ?? "MONTHLY",
      startDate,
      nextDueDate: startDate,
      notes: input.notes ?? null,
      planInstallments: {
        create: Array.from({ length: input.installments }, (_, i) => {
          const dueDate = new Date(startDate);
          if (input.frequency === "WEEKLY") {
            dueDate.setDate(dueDate.getDate() + i * 7);
          } else {
            dueDate.setMonth(dueDate.getMonth() + i);
          }
          return {
            id: randomUUID(),
            installmentNo: i + 1,
            amount: installmentAmount,
            dueDate,
            status: "PENDING",
          };
        }),
      },
    },
    include: { planInstallments: true },
  });

  if (input.invoiceId) {
    await db.invoice.update({
      where: { id: input.invoiceId, tenantId: ctx.tenantId },
      data: { paymentPlanId: plan.id },
    });
  }

  revalidatePath("/billing");
  return serializeDecimal(plan);
}

export async function recordInstallmentPayment(input: {
  installmentId: string;
  amount: number;
  paymentRef?: string;
}) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.billing.write);

  const installment = await db.paymentPlanInstallment.findFirst({
    where: { id: input.installmentId },
    include: { plan: true },
  });
  if (!installment || installment.plan.tenantId !== ctx.tenantId) {
    throw new Error("Installment not found");
  }

  const paidAmount = Number(installment.paidAmount ?? 0) + input.amount;

  await db.paymentPlanInstallment.update({
    where: { id: input.installmentId },
    data: {
      paidAmount,
      paidDate: new Date(),
      status: paidAmount >= Number(installment.amount) ? "PAID" : "PARTIAL",
      paymentRef: input.paymentRef ?? null,
    },
  });

  const planPaid = Number(installment.plan.paidAmount) + input.amount;
  const allPaid = planPaid >= Number(installment.plan.totalAmount);

  await db.paymentPlan.update({
    where: { id: installment.planId },
    data: {
      paidAmount: planPaid,
      status: allPaid ? "COMPLETED" : "ACTIVE",
    },
  });

  revalidatePath("/billing");
  return { ok: true };
}

export async function getPaymentPlan(planId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.billing.read);

  const plan = await db.paymentPlan.findFirst({
    where: { id: planId, tenantId: ctx.tenantId },
    include: {
      planInstallments: { orderBy: { installmentNo: "asc" } },
      patient: { select: { firstName: true, lastName: true, patientId: true } },
    },
  });
  if (!plan) return null;
  return serializeDecimal(plan);
}

export async function getOverdueInstallments() {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.billing.read);
  const now = new Date();

  const installments = await db.paymentPlanInstallment.findMany({
    where: {
      plan: { tenantId: ctx.tenantId, status: "ACTIVE" },
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lt: now },
    },
    include: {
      plan: {
        include: {
          patient: { select: { firstName: true, lastName: true, patientId: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return installments.map((i) => serializeDecimal(i));
}

export async function getPaymentPlansForTenant() {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.billing.read);

  const plans = await db.paymentPlan.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      planInstallments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return plans.map((p) => serializeDecimal(p));
}
