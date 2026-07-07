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
import { expireStaleChairsideSessions } from "@/lib/clinical/chairside-lifecycle";
import { formatClinicTime, resolveClinicTimezone } from "@/lib/datetime/clinic-timezone";
import { isPrismaUniqueViolation, workerClaimLogId } from "@/worker/claim";

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;
const TRIAL_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const RECALL_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DAILY_BILLING_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CHAIRSIDE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
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

async function claimOutboundSend(params: {
  claimId: string;
  tenantId: string;
  patientId?: string | null;
  subject: string;
}): Promise<boolean> {
  try {
    await db.communicationLog.create({
      data: {
        id: params.claimId,
        tenantId: params.tenantId,
        patientId: params.patientId ?? null,
        channel: CampaignChannel.EMAIL,
        subject: params.subject,
        body: "pending",
        status: "pending",
      },
    });
    return true;
  } catch (err) {
    if (isPrismaUniqueViolation(err)) return false;
    throw err;
  }
}

async function markOutboundSent(claimId: string, body: string) {
  await db.communicationLog.update({
    where: { id: claimId },
    data: { body, status: "sent" },
  });
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
  setInterval(runChairsideStaleSessionJob, CHAIRSIDE_CLEANUP_INTERVAL_MS);

  console.log("[worker] Jobs scheduled. Running…");
}

async function runAllJobs() {
  await Promise.allSettled([
    runReminderJob(),
    runTrialExpiryJob(),
    runRecallReminderJob(),
    runExpiredTrialEnforcementJob(),
    runPastDueDunningJob(),
    runChairsideStaleSessionJob(),
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
      isBlock: false,
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
      tenant: { select: { name: true, timezone: true } },
    },
  });

  let sent = 0;

  for (const appt of appointments) {
    if (!appt.patient?.email || !appt.patientId) continue;

    const subject = reminderSubject(appt.id, params.kind);
    const claimId = workerClaimLogId(`reminder_${params.kind}`, appt.id);
    const claimed = await claimOutboundSend({
      claimId,
      tenantId: appt.tenantId,
      patientId: appt.patientId,
      subject,
    });
    if (!claimed) continue;

    try {
      await sendAppointmentReminder({
        to: appt.patient.email,
        patientName: `${appt.patient.firstName} ${appt.patient.lastName}`.trim(),
        clinicName: appt.tenant.name,
        appointmentDate: appt.startTime,
        appointmentTime: formatClinicTime(
          appt.startTime,
          resolveClinicTimezone(appt.tenant.timezone),
        ),
        doctorName: formatDoctorName(appt.doctor, appt.provider),
      });

      await markOutboundSent(claimId, `Appointment ${params.kind} reminder sent`);

      if (params.kind === "24h") {
        await db.appointment.update({
          where: { id: appt.id },
          data: { reminderSent: true },
        });
      }

      sent++;
      console.log(`[worker] ${params.kind} reminder sent for appointment ${appt.id}`);
    } catch (err) {
      await db.communicationLog.delete({ where: { id: claimId } }).catch(() => null);
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

        const claimed = await db.recall.updateMany({
          where: { id: recall.id, reminderSentAt: null },
          data: { reminderSentAt: new Date() },
        });
        if (claimed.count === 0) continue;

        try {
          await sendMail({
            to: recall.patient.email,
            subject: "Time for your dental checkup",
            text: `Dear ${recall.patient.firstName}, it's time for your routine dental checkup at ${tenant.name}. Please call us to schedule your appointment.`,
          });
          sent++;
        } catch (err) {
          await db.recall
            .update({
              where: { id: recall.id },
              data: { reminderSentAt: null },
            })
            .catch(() => null);
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

      const subject = `dentaflow:trial_warning:${tenant.id}:${daysRemaining}d`;
      const claimId = workerClaimLogId(`trial_warning_${daysRemaining}d`, tenant.id);
      const claimed = await claimOutboundSend({
        claimId,
        tenantId: tenant.id,
        subject,
      });
      if (!claimed) continue;

      try {
        await sendTrialExpiryWarning({
          to: owner.email,
          clinicName: tenant.name,
          trialEndsAt: tenant.trialEndsAt,
          upgradeUrl: `${APP_BASE_URL}/billing/subscription`,
          daysRemaining,
        });

        await markOutboundSent(claimId, `Trial warning (${daysRemaining}d) sent`);
        await markTrialWarningSent(tenant.id, daysRemaining, tenant.metadata);
        console.log(`[worker] Trial warning (${daysRemaining}d) sent to ${owner.email}`);
      } catch (err) {
        await db.communicationLog.delete({ where: { id: claimId } }).catch(() => null);
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
      const transitioned = await db.tenant.updateMany({
        where: {
          id: tenant.id,
          subscriptionStatus: SubscriptionStatus.TRIALING,
          trialEndsAt: { lt: new Date() },
          stripeSubscriptionId: null,
        },
        data: { subscriptionStatus: SubscriptionStatus.EXPIRED },
      });
      if (transitioned.count === 0) continue;

      const to = tenant.email ?? (await getTenantOwnerEmail(tenant.id));
      if (!to) {
        console.log(`[worker] trial expired: ${tenant.name}`);
        continue;
      }

      const claimId = workerClaimLogId("trial_expired", tenant.id);
      const claimed = await claimOutboundSend({
        claimId,
        tenantId: tenant.id,
        subject: `dentaflow:trial_expired:${tenant.id}`,
      });
      if (!claimed) {
        console.log(`[worker] trial expired: ${tenant.name}`);
        continue;
      }

      try {
        await sendMail({
          to,
          subject: `Your DentaFlow trial has ended — ${tenant.name}`,
          text: `Your trial for ${tenant.name} has ended. Your data is safe but access is paused until you upgrade.

Upgrade here: ${APP_BASE_URL}/billing/subscription`,
        });
        await markOutboundSent(claimId, "Trial expired notification sent");
      } catch (err) {
        await db.communicationLog.delete({ where: { id: claimId } }).catch(() => null);
        console.error(`[worker] trial expired email failed for ${tenant.id}:`, err);
      }

      console.log(`[worker] trial expired: ${tenant.name}`);
    }
  } catch (err) {
    console.error("[worker] expired trial enforcement failed:", err);
  }
}

async function runChairsideStaleSessionJob() {
  try {
    const expired = await expireStaleChairsideSessions();
    if (expired > 0) {
      console.log(`[worker] Expired ${expired} stale chairside session(s)`);
    }
  } catch (err) {
    console.error("[worker] chairside stale session job failed:", err);
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

    const dayKey = new Date().toISOString().slice(0, 10);
    let sent = 0;

    for (const tenant of pastDueTenants) {
      const to = tenant.email ?? (await getTenantOwnerEmail(tenant.id));
      if (!to) continue;

      const claimId = workerClaimLogId(`past_due_${dayKey}`, tenant.id);
      const claimed = await claimOutboundSend({
        claimId,
        tenantId: tenant.id,
        subject: `dentaflow:past_due_dunning:${tenant.id}:${dayKey}`,
      });
      if (!claimed) continue;

      try {
        await sendMail({
          to,
          subject: `Action required: Payment failed for ${tenant.name}`,
          text: `We couldn't process payment for your DentaFlow subscription for ${tenant.name}.

Please update your payment method to avoid service interruption:
${APP_BASE_URL}/billing/subscription

If payment is not received within 7 days, your account will be suspended.`,
        });
        await markOutboundSent(claimId, `Past due dunning sent (${dayKey})`);
        sent++;
      } catch (err) {
        await db.communicationLog.delete({ where: { id: claimId } }).catch(() => null);
        console.error(`[worker] past due email failed for ${tenant.id}:`, err);
      }
    }

    if (sent > 0) {
      console.log(`[worker] past due dunning sent for ${sent} tenant(s)`);
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
