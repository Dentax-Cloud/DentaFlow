import { db } from "@/lib/db";
import {
  createNotification,
  type NotificationType,
} from "@/lib/notifications/notification-service";
import {
  buildTreatmentPlanBookingSuggestionBody,
  countOutstandingUnscheduledTreatmentItems,
  treatmentPlanBookingLink,
  type TreatmentPlanSnapshot,
} from "@/lib/encounter/treatment-plan-booking-suggestion";
import {
  buildVisitFinancialEstimateSummary,
  computeVisitFinancialEstimate,
} from "@/lib/encounter/visit-financial-estimate";

async function notifyStaffRoles(params: {
  tenantId: string;
  roles: string[];
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  entityType: string;
  entityId: string;
}) {
  const staff = await db.staffMember.findMany({
    where: {
      tenantId: params.tenantId,
      role: { in: params.roles as never[] },
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, email: true },
    take: 12,
  });

  for (const member of staff) {
    await createNotification({
      tenantId: params.tenantId,
      recipientId: member.id,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
      entityType: params.entityType,
      entityId: params.entityId,
      channel: "IN_APP",
      emailTo: member.email ?? undefined,
      emailSubject: `DentaFlow: ${params.title}`,
    }).catch(() => null);
  }
}

export async function runPostDerivedVisitIntelligence(params: {
  tenantId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  countryCode: string;
}) {
  const estimate = await computeVisitFinancialEstimate({
    tenantId: params.tenantId,
    patientId: params.patientId,
    appointmentId: params.appointmentId,
  });

  if (estimate) {
    const body = buildVisitFinancialEstimateSummary(estimate, params.countryCode);
    await notifyStaffRoles({
      tenantId: params.tenantId,
      roles: ["RECEPTIONIST", "FINANCE", "ADMIN", "OWNER"],
      type: "APPOINTMENT_COMPLETED",
      title: "Visit complete — estimated charges",
      body,
      link: `/billing/ready-to-invoice`,
      entityType: "Appointment",
      entityId: params.appointmentId,
    });
  }

  await maybeNotifyTreatmentPlanBookingSuggestion({
    tenantId: params.tenantId,
    patientId: params.patientId,
    patientName: params.patientName,
    appointmentId: params.appointmentId,
  }).catch(() => null);
}

export async function maybeNotifyTreatmentPlanBookingSuggestion(params: {
  tenantId: string;
  patientId: string;
  patientName: string;
  appointmentId: string;
}) {
  const plans = await db.treatmentPlan.findMany({
    where: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      deletedAt: null,
      status: { in: ["DRAFT", "PROPOSED", "ACCEPTED", "IN_PROGRESS"] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      items: {
        select: {
          status: true,
          linkedAppointmentId: true,
        },
      },
    },
  });

  const snapshots: TreatmentPlanSnapshot[] = plans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    status: plan.status,
    items: plan.items,
  }));

  const outstandingCount = countOutstandingUnscheduledTreatmentItems(snapshots);
  if (outstandingCount <= 0) return;

  const body = buildTreatmentPlanBookingSuggestionBody({
    patientName: params.patientName,
    outstandingCount,
  });
  const link = treatmentPlanBookingLink(params.patientId);

  await notifyStaffRoles({
    tenantId: params.tenantId,
    roles: ["RECEPTIONIST", "ADMIN", "OWNER"],
    type: "RECALL_DUE",
    title: "Treatment plan — book next visit",
    body,
    link,
    entityType: "Patient",
    entityId: params.patientId,
  });
}
