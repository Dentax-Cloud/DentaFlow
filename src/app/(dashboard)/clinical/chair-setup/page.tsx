export const runtime = "nodejs";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import ChairSetupClient from "./chair-setup-client";
import {
  getTodaySession,
  getTrayTemplates,
  getDoctorChairSchedule,
} from "@/app/(dashboard)/features/clinical/chair-setup-actions";
import type { SetupItem, TrayTemplateItem } from "@/lib/chair-setup/types";
import { isDoctorRole } from "@/lib/chair-setup/helpers";
import { AppointmentStatus } from "@prisma/client";
import {
  redirectIfStaffMemberMissing,
  requireStaffMemberRole,
} from "@/lib/rbac/staff-role";

export default async function ChairSetupPage() {
  const ctx = await requireTenantContext();
  redirectIfStaffMemberMissing(ctx);
  const userRole = requireStaffMemberRole(ctx);
  const staffId = ctx.staffMember!.id;
  const today = new Date().toISOString().split("T")[0];
  const dayStart = new Date(`${today}T00:00:00`);
  const dayEnd = new Date(`${today}T23:59:59.999`);

  const [
    session,
    templates,
    doctorSchedules,
    chairs,
    doctors,
    inventoryItems,
    tenant,
    todayAppointments,
  ] = await Promise.all([
    getTodaySession(),
    getTrayTemplates(),
    getDoctorChairSchedule(today),
    db.chair.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { number: "asc" },
    }),
    db.staffMember.findMany({
      where: {
        tenantId: ctx.tenantId,
        role: { in: ["DOCTOR", "DENTIST", "HYGIENIST"] },
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: { firstName: "asc" },
    }),
    db.inventoryItem.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        itemRef: true,
        quantity: true,
        unit: true,
        cost: true,
        category: true,
      },
      orderBy: { name: "asc" },
    }),
    db.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { currency: true, countryCode: true },
    }),
    db.appointment.findMany({
      where: {
        tenantId: ctx.tenantId,
        startTime: { gte: dayStart, lte: dayEnd },
        deletedAt: null,
        status: { notIn: ["CANCELED", "NO_SHOW"] },
      },
      select: {
        id: true,
        chairId: true,
        status: true,
      },
    }),
  ]);

  let openedByName: string | null = null;
  if (session?.openedById) {
    const opener = await db.staffMember.findFirst({
      where: { id: session.openedById, tenantId: ctx.tenantId },
      select: { firstName: true, lastName: true },
    });
    if (opener) {
      openedByName = [opener.firstName, opener.lastName].filter(Boolean).join(" ");
    }
  }

  let visibleChairs = chairs.filter((c) => c.isActive || c.status !== "INACTIVE");
  if (isDoctorRole(userRole) && staffId) {
    const assignedChairIds = new Set(
      doctorSchedules.filter((s) => s.doctorId === staffId).map((s) => s.chairId),
    );
    visibleChairs = visibleChairs.filter((c) => assignedChairIds.has(c.id));
  }

  const apptStatsByChair = new Map<
    string,
    { total: number; completed: number; inChair: boolean }
  >();
  for (const appt of todayAppointments) {
    if (!appt.chairId) continue;
    const stats = apptStatsByChair.get(appt.chairId) ?? {
      total: 0,
      completed: 0,
      inChair: false,
    };
    stats.total += 1;
    if (appt.status === AppointmentStatus.COMPLETED) stats.completed += 1;
    if (appt.status === AppointmentStatus.IN_CHAIR) stats.inChair = true;
    apptStatsByChair.set(appt.chairId, stats);
  }

  return (
    <ChairSetupClient
      userRole={userRole}
      currency={tenant?.currency ?? "AED"}
      countryCode={tenant?.countryCode ?? "AE"}
      session={
        session
          ? {
              id: session.id,
              sessionDate: session.sessionDate,
              status: session.status,
              notes: session.notes,
              summary: session.summary,
              openedAt: session.openedAt?.toISOString() ?? null,
              closedAt: session.closedAt?.toISOString() ?? null,
              openedByName,
              chairSetups: session.chairSetups.map((s) => {
                const serialized = serializeDecimal(s);
                return {
                  id: s.id,
                  chairId: s.chairId,
                  doctorId: s.doctorId,
                  templateId: s.templateId,
                  status: s.status,
                  setupCost: Number(serialized.setupCost ?? 0),
                  setupItems: (s.setupItems as SetupItem[]).map((item) => ({
                    ...item,
                    category: item.category ?? "CONSUMABLE",
                  })),
                  consumedItems: (s.consumedItems as SetupItem[]).map((item) => ({
                    ...item,
                    category: item.category ?? "CONSUMABLE",
                  })),
                  returnedItems: s.returnedItems as Array<{
                    inventoryItemId: string;
                    qty: number;
                  }>,
                  createdAt: s.createdAt.toISOString(),
                  updatedAt: s.updatedAt.toISOString(),
                  chair: s.chair,
                  template: s.template,
                };
              }),
            }
          : null
      }
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        isDefault: t.isDefault,
        notes: t.notes,
        items: (t.items as TrayTemplateItem[]).map((item) => ({
          ...item,
          category: item.category ?? "CONSUMABLE",
        })),
        createdAt: t.createdAt.toISOString(),
      }))}
      doctorSchedules={doctorSchedules.map((s) => ({
        id: s.id,
        chairId: s.chairId,
        doctorId: s.doctorId,
        scheduleDate: s.scheduleDate,
        startTime: s.startTime,
        endTime: s.endTime,
        shiftType: s.shiftType,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        chair: s.chair,
      }))}
      chairs={visibleChairs.map((c) => ({
        id: c.id,
        name: c.name,
        number: c.number,
        branchId: c.branchId,
        chairType: c.chairType,
        roomName: c.roomName,
        colorCode: c.colorCode,
        equipment: (c.equipment as string[] | null) ?? [],
        status: c.status,
      }))}
      doctors={doctors.map((d) => ({
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        role: d.role,
      }))}
      inventoryItems={inventoryItems.map((i) => ({
        id: i.id,
        name: i.name,
        itemRef: i.itemRef,
        quantity: i.quantity,
        unit: i.unit,
        cost: i.cost ? Number(i.cost) : null,
        category: i.category,
      }))}
      apptStatsByChair={Object.fromEntries(apptStatsByChair)}
      today={today}
    />
  );
}
