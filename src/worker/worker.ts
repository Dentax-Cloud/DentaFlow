/**
 * Background worker — appointment reminders + trial expiry emails.
 * Runs as a separate process in Docker (see docker-compose.dev.yml).
 * Polling-based; upgrade to BullMQ/Redis for production scale.
 */

import {
  AppointmentStatus,
  CampaignChannel,
  SubscriptionStatus,
  TenantStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { sendAppointmentReminder, sendTrialExpiryWarning, sendMail } from "@/lib/mail";
import { parseRecallSettings } from "@/lib/recall/helpers";

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;
const TRIAL_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const RECALL_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DAILY_BILLING_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REMINDER_WINDOW_MS = 5 * 60 * 1000;

const TRIAL_WARNING_DAYS = [7, 3, 1] as const;

const APP_BASE_URL =
  process.env.NEXTAUTH_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://localhost:3000";

function reminderSubject(appointmentId: string, kind: "24h" | "1h") {
  return `dentaflow:appointment_reminder:${kind}:${appointmentId}`;
}

function formatDoctorName(
  doctor?: {
    user: { firstName: string | null; lastName: string | null } | null;
  } | null,
  provider?: { firstName: string | null; lastName: string | null } | null,
): string {
  const fromDoctor = doctor?.user
    ? `${doctor.user.firstName ?? ""} ${doctor.user.lastName ?? ""}`.trim()
    : "";
  if (fromDoctor) return fromDoctor;

  const fromProvider = provider
    ? `${provider.firstName ?? ""} ${provider.lastName ?? ""}`.trim()
    : "";
  return fromProvider || "your dentist";
}

async function wasReminderSent(appointmentId: string, kind: "24h" | "1h") {
  const existing = await db.communicationLog.findFirst({
    where: { subject: reminderSubject(appointmentId, kind) },
    select: { id: true },
  });
  return Boolean(existing);
}

async function recordReminderSent(params: {
  appointmentId: string;
  tenantId: string;
  patientId: string;
  kind: "24h" | "1h";
}) {
  await db.communicationLog.create({
    data: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      channel: CampaignChannel.EMAIL,
      subject: reminderSubject(params.appointmentId, params.kind),
      body: `Appointment ${params.kind} reminder sent`,
      status: "sent",
    },
  });

  if (params.kind === "24h") {
    await db.appointment.update({
      where: { id: params.appointmentId },
      data: { reminderSent: true },
    });
  }
}

function trialWarningsSent(metadata: unknown): Record<string, string> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const raw = (metadata as Record<string, unknown>).trialWarningsSent;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

async function markTrialWarningSent(tenantId: string, daysRemaining: number, metadata: unknown) {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  const sent = trialWarningsSent(metadata);
  sent[`${daysRemaining}d`] = new Date().toISOString();

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      metadata: {
        ...base,
        trialWarningsSent: sent,
      },
    },
  });
}

async function run() {
  console.log("[worker] DentaFlow worker starting…");
  await db.$connect();
  console.log("[worker] DB connected");

  await runAllJobs();

  setInterval(runReminderJob, REMINDER_INTERVAL_MS);
  setInterval(runTrialExpiryJob, TRIAL_CHECK_INTERVAL_MS);
  setInterval(runRecallReminderJob, RECALL_CHECK_INTERVAL_MS);
  setInterval(runExpiredTrialEnforcementJob, DAILY_BILLING_INTERVAL_MS);
  setInterval(runPastDueDunningJob, DAILY_BILLING_INTERVAL_MS);

  console.log("[worker] Jobs scheduled. Running…");
}

async function runAllJobs() {
  await Promise.allSettled([
    runReminderJob(),
    runTrialExpiryJob(),
    runRecallReminderJob(),
    runExpiredTrialEnforcementJob(),
    runPastDueDunningJob(),
  ]);
}

async function sendRemindersForWindow(params: {
  windowStart: Date;
  windowEnd: Date;
  kind: "24h" | "1h";
}) {
  const appointments = await db.appointment.findMany({
    where: {
      deletedAt: null,
      startTime: { gte: params.windowStart, lte: params.windowEnd },
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
    },
    include: {
      patient: { select: { firstName: true, lastName: true, email: true } },
      doctor: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      provider: { select: { firstName: true, lastName: true } },
      tenant: { select: { name: true } },
    },
  });

  let sent = 0;

  for (const appt of appointments) {
    if (!appt.patient.email) continue;
    if (await wasReminderSent(appt.id, params.kind)) continue;

    try {
      await sendAppointmentReminder({
        to: appt.patient.email,
        patientName: `${appt.patient.firstName} ${appt.patient.lastName}`.trim(),
        clinicName: appt.tenant.name,
        appointmentDate: appt.startTime,
        appointmentTime: appt.startTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        doctorName: formatDoctorName(appt.doctor, appt.provider),
      });

      await recordReminderSent({
        appointmentId: appt.id,
        tenantId: appt.tenantId,
        patientId: appt.patientId,
        kind: params.kind,
      });

      sent++;
      console.log(`[worker] ${params.kind} reminder sent for appointment ${appt.id}`);
    } catch (err) {
      console.error(`[worker] ${params.kind} reminder failed for ${appt.id}:`, err);
    }
  }

  return sent;
}

async function runReminderJob() {
  const now = Date.now();
  const in24hStart = new Date(now + 24 * 60 * 60 * 1000);
  const in24hEnd = new Date(in24hStart.getTime() + REMINDER_WINDOW_MS);
  const in1hStart = new Date(now + 60 * 60 * 1000);
  const in1hEnd = new Date(in1hStart.getTime() + REMINDER_WINDOW_MS);

  try {
    const [sent24h, sent1h] = await Promise.all([
      sendRemindersForWindow({ windowStart: in24hStart, windowEnd: in24hEnd, kind: "24h" }),
      sendRemindersForWindow({ windowStart: in1hStart, windowEnd: in1hEnd, kind: "1h" }),
    ]);

    if (sent24h + sent1h > 0) {
      console.log(`[worker] Reminders: ${sent24h} 24h, ${sent1h} 1h`);
    }
  } catch (err) {
    console.error("[worker] reminder job failed:", err);
  }
}

async function runRecallReminderJob() {
  try {
    const tenants = await db.tenant.findMany({
      where: { deletedAt: null, status: TenantStatus.ACTIVE },
      select: { id: true, name: true, metadata: true },
    });

    let sent = 0;

    for (const tenant of tenants) {
      const settings = parseRecallSettings(tenant.metadata);
      const leadMs = settings.reminderLeadDays * 24 * 60 * 60 * 1000;
      const windowEnd = new Date(Date.now() + leadMs);

      const recalls = await db.recall.findMany({
        where: {
          tenantId: tenant.id,
          status: "PENDING",
          completedAt: null,
          dueDate: { lte: windowEnd },
          reminderSentAt: null,
        },
        include: { patient: true },
      });

      for (const recall of recalls) {
        if (!recall.patient.email) continue;
        try {
          await sendMail({
            to: recall.patient.email,
            subject: "Time for your dental checkup",
            text: `Dear ${recall.patient.firstName}, it's time for your routine dental checkup at ${tenant.name}. Please call us to schedule your appointment.`,
          });
          await db.recall.update({
            where: { id: recall.id },
            data: { reminderSentAt: new Date() },
          });
          sent++;
        } catch (err) {
          console.error(`[worker] recall reminder failed for ${recall.id}:`, err);
        }
      }
    }

    if (sent > 0) {
      console.log(`[worker] Recall reminders sent: ${sent}`);
    }
  } catch (err) {
    console.error("[worker] recall reminder job failed:", err);
  }
}

async function runTrialExpiryJob() {
  try {
    const tenantsOnTrial = await db.tenant.findMany({
      where: {
        deletedAt: null,
        status: TenantStatus.ACTIVE,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndsAt: { not: null, gt: new Date() },
      },
    });

    for (const tenant of tenantsOnTrial) {
      if (!tenant.trialEndsAt) continue;

      const memberships = await db.tenant_memberships.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
          role: { in: ["ADMIN", "OWNER"] },
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      });

      const membership = memberships[0];
      if (!membership) continue;

      const owner = await db.auth_users.findUnique({
        where: { id: membership.userId },
        select: { email: true, name: true },
      });

      if (!owner?.email) continue;

      const daysRemaining = Math.ceil(
        (tenant.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      );

      if (!TRIAL_WARNING_DAYS.includes(daysRemaining as (typeof TRIAL_WARNING_DAYS)[number])) {
        continue;
      }

      const sent = trialWarningsSent(tenant.metadata);
      if (sent[`${daysRemaining}d`]) continue;

      try {
        await sendTrialExpiryWarning({
          to: owner.email,
          clinicName: tenant.name,
          trialEndsAt: tenant.trialEndsAt,
          upgradeUrl: `${APP_BASE_URL}/billing/subscription`,
          daysRemaining,
        });

        await markTrialWarningSent(tenant.id, daysRemaining, tenant.metadata);
        console.log(`[worker] Trial warning (${daysRemaining}d) sent to ${owner.email}`);
      } catch (err) {
        console.error(`[worker] Trial warning failed for ${tenant.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[worker] trial expiry job failed:", err);
  }
}

async function getTenantOwnerEmail(tenantId: string): Promise<string | null> {
  const membership = await db.tenant_memberships.findFirst({
    where: {
      tenantId,
      isActive: true,
      role: { in: ["ADMIN", "OWNER"] },
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (!membership) return null;

  const owner = await db.auth_users.findUnique({
    where: { id: membership.userId },
    select: { email: true },
  });
  return owner?.email ?? null;
}

async function runExpiredTrialEnforcementJob() {
  try {
    const expiredTenants = await db.tenant.findMany({
      where: {
        deletedAt: null,
        status: TenantStatus.ACTIVE,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndsAt: { lt: new Date() },
        stripeSubscriptionId: null,
      },
    });

    for (const tenant of expiredTenants) {
      await db.tenant.update({
        where: { id: tenant.id },
        data: { subscriptionStatus: SubscriptionStatus.EXPIRED },
      });

      const to = tenant.email ?? (await getTenantOwnerEmail(tenant.id));
      if (to) {
        await sendMail({
          to,
          subject: `Your DentaFlow trial has ended — ${tenant.name}`,
          text: `Your trial for ${tenant.name} has ended. Your data is safe but access is paused until you upgrade.

Upgrade here: ${APP_BASE_URL}/billing/subscription`,
        }).catch((err) => console.error(`[worker] trial expired email failed for ${tenant.id}:`, err));
      }

      console.log(`[worker] trial expired: ${tenant.name}`);
    }
  } catch (err) {
    console.error("[worker] expired trial enforcement failed:", err);
  }
}

async function runPastDueDunningJob() {
  try {
    const pastDueTenants = await db.tenant.findMany({
      where: {
        deletedAt: null,
        status: TenantStatus.ACTIVE,
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
      },
    });

    for (const tenant of pastDueTenants) {
      const to = tenant.email ?? (await getTenantOwnerEmail(tenant.id));
      if (!to) continue;

      await sendMail({
        to,
        subject: `Action required: Payment failed for ${tenant.name}`,
        text: `We couldn't process payment for your DentaFlow subscription for ${tenant.name}.

Please update your payment method to avoid service interruption:
${APP_BASE_URL}/billing/subscription

If payment is not received within 7 days, your account will be suspended.`,
      }).catch((err) => console.error(`[worker] past due email failed for ${tenant.id}:`, err));
    }

    if (pastDueTenants.length > 0) {
      console.log(`[worker] past due dunning sent for ${pastDueTenants.length} tenant(s)`);
    }
  } catch (err) {
    console.error("[worker] past due dunning job failed:", err);
  }
}

process.on("SIGTERM", async () => {
  console.log("[worker] SIGTERM received, shutting down…");
  await db.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await db.$disconnect();
  process.exit(0);
});

run().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
