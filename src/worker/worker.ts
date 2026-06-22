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
import { sendAppointmentReminder, sendTrialExpiryWarning } from "@/lib/mail";

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;
const TRIAL_CHECK_INTERVAL_MS = 60 * 60 * 1000;
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

  console.log("[worker] Jobs scheduled. Running…");
}

async function runAllJobs() {
  await Promise.allSettled([runReminderJob(), runTrialExpiryJob()]);
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
