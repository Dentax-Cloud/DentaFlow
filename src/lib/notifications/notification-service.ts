import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";

export type NotificationType =
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_RESCHEDULED"
  | "PATIENT_ARRIVED"
  | "PATIENT_IN_CHAIR"
  | "APPOINTMENT_COMPLETED"
  | "CHAIR_READY"
  | "CHAIR_LOW_STOCK"
  | "NEW_BOOKING_REQUEST"
  | "BOOKING_CONFIRMED"
  | "BOOKING_DECLINED"
  | "LAB_RESULT_READY"
  | "INVOICE_PAID"
  | "RECALL_DUE";

export type NotificationChannel = "IN_APP" | "EMAIL" | "BOTH";

export type CreateNotificationInput = {
  tenantId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  channel?: NotificationChannel;
  emailTo?: string;
  emailSubject?: string;
};

function appBaseUrl() {
  return (
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const channel = input.channel ?? "BOTH";

  const notification = await db.notification.create({
    data: {
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      channel,
      isRead: false,
    },
  });

  if ((channel === "EMAIL" || channel === "BOTH") && input.emailTo) {
    const baseUrl = appBaseUrl();
    const sent = await sendMail({
      to: input.emailTo,
      subject: input.emailSubject ?? input.title,
      text: `${input.body}${input.link ? `\n\nView: ${baseUrl}${input.link}` : ""}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#0ea5e9">${input.title}</h2>
          <p>${input.body.replace(/\n/g, "<br>")}</p>
          ${
            input.link
              ? `<a href="${baseUrl}${input.link}"
               style="display:inline-block;margin-top:16px;padding:12px 24px;
                      background:#0ea5e9;color:white;text-decoration:none;
                      border-radius:8px;font-weight:600">
              View Details
            </a>`
              : ""
          }
        </div>
      `,
    }).catch(() => false);

    if (sent) {
      await db.notification.update({
        where: { id: notification.id },
        data: { emailSentAt: new Date() },
      });
    }
  }
}

export async function notifyMultiple(
  recipients: Array<{ id: string; email?: string }>,
  input: Omit<CreateNotificationInput, "recipientId" | "emailTo">,
): Promise<void> {
  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        ...input,
        recipientId: recipient.id,
        emailTo: recipient.email,
      }),
    ),
  );
}

export type NotifyAppointmentStatusOptions = {
  /** When status is COMPLETED, whether an invoice was actually created. */
  invoiceId?: string | null;
};

async function resolveAppointmentProcedureLabel(params: {
  tenantId: string;
  procedureId: string | null;
  title: string;
  type: string | null;
}): Promise<string | null> {
  if (params.procedureId) {
    const procedure = await db.procedureCatalog.findFirst({
      where: { id: params.procedureId, tenantId: params.tenantId },
      select: { code: true, name: true },
    });
    if (procedure) {
      return `${procedure.code} · ${procedure.name}`;
    }
  }
  if (params.type?.trim()) return params.type.trim();
  if (params.title?.trim() && params.title.trim().toLowerCase() !== "appointment") {
    return params.title.trim();
  }
  return null;
}

export async function notifyAppointmentStatus(
  appointmentId: string,
  tenantId: string,
  status: string,
  patientName: string,
  options?: NotifyAppointmentStatusOptions,
): Promise<void> {
  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, tenantId },
    include: {
      doctor: {
        select: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      provider: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      patient: {
        select: { id: true, firstName: true, lastName: true, patientId: true },
      },
      chair: { select: { name: true } },
    },
  });

  const recipient = appointment?.doctor?.user ?? appointment?.provider;
  if (!appointment || !recipient) return;

  const appointmentTime = new Date(appointment.startTime).toLocaleTimeString("en-AE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const appointmentDate = new Date(appointment.startTime).toLocaleDateString("en-AE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const chairLabel = appointment.chair?.name ?? "Unassigned";
  const procedureLabel = await resolveAppointmentProcedureLabel({
    tenantId,
    procedureId: appointment.procedureId,
    title: appointment.title,
    type: appointment.type,
  });

  let completedInvoiceId: string | null | undefined = options?.invoiceId;
  if (status === "COMPLETED" && completedInvoiceId === undefined) {
    const session = await db.chairsideSession.findFirst({
      where: {
        tenantId,
        appointmentId,
        invoiceId: { not: null },
      },
      orderBy: { finalizedAt: "desc" },
      select: { invoiceId: true },
    });
    completedInvoiceId = session?.invoiceId ?? null;
  }

  const inChairBodyLines = [
    `${patientName} is now in chair.`,
    `Chair: ${chairLabel}`,
    procedureLabel ? `Procedure: ${procedureLabel}` : null,
    `Time: ${appointmentTime}`,
  ].filter(Boolean) as string[];

  const completedBody = completedInvoiceId
    ? `Visit for ${patientName} is complete. Invoice is ready in Billing.`
    : `Visit for ${patientName} is complete. No invoice was created for this visit.`;

  const notifications: Record<
    string,
    { title: string; body: string; type: NotificationType; link: string }
  > = {
    CONFIRMED: {
      type: "APPOINTMENT_CONFIRMED",
      title: "Appointment Confirmed",
      body: `${patientName} confirmed for ${appointmentDate} at ${appointmentTime}${appointment.chair ? ` · ${appointment.chair.name}` : ""}`,
      link: `/appointments?appointmentId=${appointmentId}`,
    },
    ARRIVED: {
      type: "PATIENT_ARRIVED",
      title: "Patient Arrived",
      body: `${patientName} has checked in and is waiting.\nChair: ${chairLabel}\nTime: ${appointmentTime}`,
      link: `/appointments?appointmentId=${appointmentId}`,
    },
    IN_CHAIR: {
      type: "PATIENT_IN_CHAIR",
      title: "Patient In Chair",
      body: inChairBodyLines.join("\n"),
      link: appointment.patientId
        ? `/clinical/chairside?patientId=${appointment.patientId}&appointmentId=${appointmentId}`
        : `/appointments?appointmentId=${appointmentId}`,
    },
    COMPLETED: {
      type: "APPOINTMENT_COMPLETED",
      title: "Appointment Completed",
      body: completedBody,
      link: completedInvoiceId
        ? `/billing?invoiceId=${completedInvoiceId}`
        : `/appointments?appointmentId=${appointmentId}`,
    },
    CANCELED: {
      type: "APPOINTMENT_CANCELLED",
      title: "Appointment Cancelled",
      body: `${patientName}'s appointment on ${appointmentDate} at ${appointmentTime} has been cancelled.`,
      link: `/appointments?appointmentId=${appointmentId}`,
    },
  };

  const notif = notifications[status];
  if (!notif) return;

  await createNotification({
    tenantId,
    recipientId: recipient.id,
    type: notif.type,
    title: notif.title,
    body: notif.body,
    link: notif.link,
    entityType: "Appointment",
    entityId: appointmentId,
    channel: "BOTH",
    emailTo: recipient.email ?? undefined,
    emailSubject: `DentaFlow: ${notif.title}`,
  });
}
