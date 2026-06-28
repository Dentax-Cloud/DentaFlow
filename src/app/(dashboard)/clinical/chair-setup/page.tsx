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
import type { SetupItem, TrayTemplateItem } from "@/app/(dashboard)/features/clinical/chair-setup-actions";

export default async function ChairSetupPage() {
  const ctx = await requireTenantContext();
  const today = new Date().toISOString().split("T")[0];

  const [session, templates, doctorSchedules, chairs, doctors, inventoryItems] =
    await Promise.all([
      getTodaySession(),
      getTrayTemplates(),
      getDoctorChairSchedule(today),
      db.chair.findMany({
        where: { tenantId: ctx.tenantId, isActive: true },
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
        },
        orderBy: { name: "asc" },
      }),
    ]);

  return (
    <ChairSetupClient
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
              chairSetups: session.chairSetups.map((s) => {
                const serialized = serializeDecimal(s);
                return {
                  id: s.id,
                  chairId: s.chairId,
                  doctorId: s.doctorId,
                  templateId: s.templateId,
                  status: s.status,
                  setupCost: Number(serialized.setupCost ?? 0),
                  setupItems: s.setupItems as SetupItem[],
                  consumedItems: s.consumedItems as SetupItem[],
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
        items: t.items as TrayTemplateItem[],
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
      chairs={chairs.map((c) => ({
        id: c.id,
        name: c.name,
        number: c.number,
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
      }))}
      today={today}
    />
  );
}
