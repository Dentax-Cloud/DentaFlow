import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications/notification-service";
import { sendMail } from "@/lib/mail";

export async function notifyInvoicePaid(params: {
  tenantId: string;
  invoiceId: string;
  patientId: string;
  amount: number;
}) {
  const admins = await db.staffMember.findMany({
    where: {
      tenantId: params.tenantId,
      role: { in: ["ADMIN", "OWNER", "FINANCE", "ACCOUNTANT"] },
      deletedAt: null,
    },
    select: { id: true, email: true },
    take: 5,
  });

  const patient = await db.patient.findFirst({
    where: { id: params.patientId, tenantId: params.tenantId },
    select: { firstName: true, lastName: true },
  });
  const patientName = patient
    ? `${patient.firstName} ${patient.lastName}`.trim()
    : "Patient";

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        tenantId: params.tenantId,
        recipientId: admin.id,
        type: "INVOICE_PAID",
        title: "Invoice paid",
        body: `${patientName} paid invoice (${params.amount.toFixed(2)}).`,
        link: `/billing?invoiceId=${params.invoiceId}`,
        entityType: "Invoice",
        entityId: params.invoiceId,
        channel: "IN_APP",
      }),
    ),
  );
}

export async function sendInvoiceReceiptEmail(params: {
  tenantId: string;
  invoiceId: string;
}) {
  const invoice = await db.invoice.findFirst({
    where: { id: params.invoiceId, tenantId: params.tenantId, deletedAt: null },
    include: {
      patient: { select: { firstName: true, lastName: true, email: true } },
      items: true,
      tenant: { select: { name: true } },
    },
  });
  if (!invoice?.patient.email) return false;

  const lines = invoice.items
    .map(
      (item) =>
        `• ${item.description} × ${item.quantity} — ${Number(item.total).toFixed(2)} ${invoice.currency}`,
    )
    .join("\n");

  const body = `Thank you for your visit at ${invoice.tenant.name}.

Invoice ${invoice.invoiceNumber}
${lines}

Subtotal: ${Number(invoice.subtotal).toFixed(2)} ${invoice.currency}
Tax: ${Number(invoice.tax).toFixed(2)} ${invoice.currency}
Total: ${Number(invoice.total).toFixed(2)} ${invoice.currency}`;

  const sent = await sendMail({
    to: invoice.patient.email,
    subject: `Receipt — Invoice ${invoice.invoiceNumber}`,
    text: body,
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${body}</pre>`,
  }).catch(() => false);

  if (sent) {
    await db.invoice.update({
      where: { id: invoice.id },
      data: { emailedAt: new Date() },
    });
  }

  return sent;
}
