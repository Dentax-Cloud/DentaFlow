import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { EndOfDayClient } from "./end-of-day-client";

export const runtime = "nodejs";

export default async function EndOfDayPage() {
  const ctx = await requireRouteAccess("billing", "read");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [invoices, payments, newPatients] = await Promise.all([
    db.invoice.findMany({
      where: {
        tenantId: ctx.tenant.id,
        createdAt: { gte: today, lt: tomorrow },
        deletedAt: null,
      },
      select: { id: true, total: true, status: true, invoiceRef: true },
    }),
    db.payment.findMany({
      where: {
        tenantId: ctx.tenant.id,
        paidAt: { gte: today, lt: tomorrow },
      },
      select: { amount: true, method: true },
    }),
    db.patient.count({
      where: {
        tenantId: ctx.tenant.id,
        createdAt: { gte: today, lt: tomorrow },
        deletedAt: null,
      },
    }),
  ]);

  const invoiceTotal = invoices.reduce((s, i) => s + Number(i.total), 0);
  const collected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const cash = payments
    .filter((p) => p.method === "CASH")
    .reduce((s, p) => s + Number(p.amount), 0);
  const card = payments
    .filter((p) => p.method === "CARD")
    .reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = invoices
    .filter((i) => i.status !== "PAID" && i.status !== "VOID")
    .reduce((s, i) => s + Number(i.total), 0);

  return (
    <EndOfDayClient
      date={today.toISOString()}
      countryCode={ctx.tenant.countryCode}
      summary={{
        invoiceCount: invoices.length,
        invoiceTotal,
        collected,
        cash,
        card,
        outstandingCount: invoices.filter((i) => i.status !== "PAID").length,
        outstanding,
        newPatients,
      }}
    />
  );
}
