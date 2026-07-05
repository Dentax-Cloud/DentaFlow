import { randomUUID } from "crypto";
import type { Prisma, UserRole } from "@prisma/client";
import { db } from "@/lib/db";

/** Roles that need a DoctorSchedule for appointment availability. */
export const SCHEDULE_CLINICAL_ROLES = ["DOCTOR", "DENTIST", "HYGIENIST"] as const;

export type ScheduleClinicalRole = (typeof SCHEDULE_CLINICAL_ROLES)[number];

export type DefaultScheduleDay = {
  dayOfWeek: number;
  isWorkingDay: boolean;
  startTime: string;
  endTime: string;
  breaks: Array<{ start: string; end: string }>;
  slotDurationMins: number;
  bufferMins: number;
};

/** Mirrors /admin/staff/[id]/schedule page defaults (Mon–Fri 09:00–17:00, lunch 13:00–14:00). */
export function buildDefaultWeeklySchedule(): DefaultScheduleDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
    const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5;
    return {
      dayOfWeek,
      isWorkingDay,
      startTime: "09:00",
      endTime: "17:00",
      breaks: isWorkingDay ? [{ start: "13:00", end: "14:00" }] : [],
      slotDurationMins: 30,
      bufferMins: 10,
    };
  });
}

export function isScheduleClinicalRole(role: string): role is ScheduleClinicalRole {
  return (SCHEDULE_CLINICAL_ROLES as readonly string[]).includes(role);
}

type ScheduleDb = Pick<
  Prisma.TransactionClient,
  "doctorSchedule"
>;

export async function doctorHasAnySchedule(
  tenantId: string,
  doctorId: string,
  client: ScheduleDb = db,
): Promise<boolean> {
  const count = await client.doctorSchedule.count({
    where: { tenantId, doctorId },
  });
  return count > 0;
}

export async function ensureDefaultDoctorSchedule(
  tenantId: string,
  doctorId: string,
  client: ScheduleDb = db,
): Promise<"created" | "skipped"> {
  if (await doctorHasAnySchedule(tenantId, doctorId, client)) {
    return "skipped";
  }

  for (const day of buildDefaultWeeklySchedule()) {
    await client.doctorSchedule.create({
      data: {
        id: randomUUID(),
        tenantId,
        doctorId,
        dayOfWeek: day.dayOfWeek,
        branchId: null,
        isWorkingDay: day.isWorkingDay,
        startTime: day.startTime,
        endTime: day.endTime,
        breaks: day.breaks,
        slotDurationMins: day.slotDurationMins,
        bufferMins: day.bufferMins,
      },
    });
  }

  return "created";
}

export type DoctorScheduleBackfillRow = {
  tenantId: string;
  tenantSlug: string | null;
  tenantName: string;
  doctorId: string;
  doctorName: string;
  role: UserRole;
  result: "created" | "skipped";
};

export type DoctorScheduleBackfillSummary = {
  doctorsProcessed: number;
  doctorsCreated: number;
  doctorsSkipped: number;
  results: DoctorScheduleBackfillRow[];
};

export async function backfillDoctorSchedulesForAllTenants(): Promise<DoctorScheduleBackfillSummary> {
  const clinicalStaff = await db.staffMember.findMany({
    where: {
      role: { in: [...SCHEDULE_CLINICAL_ROLES] },
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      tenantId: true,
      firstName: true,
      lastName: true,
      role: true,
      tenant: { select: { slug: true, name: true } },
    },
    orderBy: [{ tenantId: "asc" }, { lastName: "asc" }],
  });

  const results: DoctorScheduleBackfillRow[] = [];
  let doctorsCreated = 0;
  let doctorsSkipped = 0;

  for (const staff of clinicalStaff) {
    const result = await ensureDefaultDoctorSchedule(staff.tenantId, staff.id);
    const doctorName =
      `${staff.firstName ?? ""} ${staff.lastName ?? ""}`.trim() || staff.id;

    if (result === "created") {
      doctorsCreated++;
      console.log(
        `  ✓ Created default schedule: ${staff.tenant.name} — ${doctorName} (${staff.role})`,
      );
    } else {
      doctorsSkipped++;
      console.log(
        `  · Skipped (already has schedule): ${staff.tenant.name} — ${doctorName}`,
      );
    }

    results.push({
      tenantId: staff.tenantId,
      tenantSlug: staff.tenant.slug,
      tenantName: staff.tenant.name,
      doctorId: staff.id,
      doctorName,
      role: staff.role,
      result,
    });
  }

  return {
    doctorsProcessed: clinicalStaff.length,
    doctorsCreated,
    doctorsSkipped,
    results,
  };
}
