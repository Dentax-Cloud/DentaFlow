import { db } from "@/lib/db";
import { getClinicDayBounds, resolveClinicTimezone } from "@/lib/datetime/clinic-timezone";

export type ChairPrepBomInput = {
  chairId: string;
  procedureCatalogId: string;
  quantity?: number;
};

export type ChairPrepBomLine = {
  procedureCatalogId: string;
  inventoryItemId: string;
  itemName: string;
  unit: string;
  quantity: number;
};

export type ChairPrepChecklistItem = {
  inventoryItemId: string;
  itemName: string;
  unit: string;
  quantity: number;
};

/** Pure aggregation: procedures without a configured BOM add no checklist entries. */
export function aggregateChairPrepMaterials(
  procedures: ChairPrepBomInput[],
  bomLines: ChairPrepBomLine[],
): Record<string, ChairPrepChecklistItem[]> {
  const byProcedure = new Map<string, ChairPrepBomLine[]>();
  for (const line of bomLines) {
    byProcedure.set(line.procedureCatalogId, [
      ...(byProcedure.get(line.procedureCatalogId) ?? []),
      line,
    ]);
  }
  const totals = new Map<string, Map<string, ChairPrepChecklistItem>>();
  for (const procedure of procedures) {
    const chair = totals.get(procedure.chairId) ?? new Map<string, ChairPrepChecklistItem>();
    totals.set(procedure.chairId, chair);
    for (const bom of byProcedure.get(procedure.procedureCatalogId) ?? []) {
      const existing = chair.get(bom.inventoryItemId);
      const amount = bom.quantity * (procedure.quantity ?? 1);
      chair.set(bom.inventoryItemId, {
        inventoryItemId: bom.inventoryItemId,
        itemName: bom.itemName,
        unit: bom.unit,
        quantity: (existing?.quantity ?? 0) + amount,
      });
    }
  }
  return Object.fromEntries(
    [...totals.entries()].map(([chairId, items]) => [
      chairId,
      [...items.values()].sort((a, b) => a.itemName.localeCompare(b.itemName)),
    ]),
  );
}

export async function loadChairPrepForDay(
  tenantId: string,
  clinicDateYmd: string,
  timezone: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clinicDateYmd)) {
    throw new Error("Clinic date must be YYYY-MM-DD.");
  }
  const { start, end } = getClinicDayBounds(
    clinicDateYmd,
    resolveClinicTimezone(timezone),
  );
  const appointments = await db.appointment.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isBlock: false,
      chairId: { not: null },
      startTime: { gte: start, lt: end },
    },
    select: { id: true, chairId: true, procedureId: true },
  });
  const appointmentProcedureIds = appointments
    .filter((a): a is typeof a & { chairId: string; procedureId: string } => Boolean(a.chairId && a.procedureId))
    .map((a) => ({ chairId: a.chairId, procedureCatalogId: a.procedureId }));
  const appointmentIds = appointments.map((a) => a.id);
  const treatmentItems =
    appointmentIds.length === 0
      ? []
      : await db.treatmentItem.findMany({
          where: { tenantId, linkedAppointmentId: { in: appointmentIds } },
          select: {
            procedureCatalogId: true,
            quantity: true,
            linkedAppointmentId: true,
          },
        });
  const chairByAppointment = new Map(
    appointments
      .filter((a): a is typeof a & { chairId: string } => Boolean(a.chairId))
      .map((a) => [a.id, a.chairId]),
  );
  const procedures = [
    ...appointmentProcedureIds,
    ...treatmentItems.flatMap((item) => {
      if (!item.procedureCatalogId || !item.linkedAppointmentId) return [];
      const chairId = chairByAppointment.get(item.linkedAppointmentId);
      if (!chairId) return [];
      return [
        {
          chairId,
          procedureCatalogId: item.procedureCatalogId,
          quantity: item.quantity,
        },
      ];
    }),
  ];
  const procedureIds = [...new Set(procedures.map((p) => p.procedureCatalogId))];
  const [bom, chairs, prepDays, setups] = await Promise.all([
    procedureIds.length === 0
      ? Promise.resolve([])
      : db.procedureBomItem.findMany({
          where: { tenantId, procedureCatalogId: { in: procedureIds } },
          select: {
            procedureCatalogId: true,
            inventoryItemId: true,
            defaultQuantity: true,
            inventoryItem: { select: { name: true, unit: true, deletedAt: true } },
          },
        }),
    db.chair.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, number: true },
    }),
    db.chairPrepDay.findMany({
      where: { tenantId, prepDate: clinicDateYmd },
      select: { chairId: true, preparedAt: true, preparedByStaffId: true },
    }),
    db.chairDaySetup.findMany({
      where: { tenantId, session: { sessionDate: clinicDateYmd } },
      select: { chairId: true, template: { select: { name: true } } },
    }),
  ]);
  const checklist = aggregateChairPrepMaterials(
    procedures,
    bom
      .filter((b) => !b.inventoryItem.deletedAt)
      .map((b) => ({
        procedureCatalogId: b.procedureCatalogId,
        inventoryItemId: b.inventoryItemId,
        itemName: b.inventoryItem.name,
        unit: b.inventoryItem.unit,
        quantity: Number(b.defaultQuantity),
      })),
  );
  const prepared = new Map(prepDays.map((d) => [d.chairId, d]));
  const tray = new Map(setups.map((s) => [s.chairId, s.template?.name ?? null]));
  return chairs.map((chair) => ({
    ...chair,
    trayTemplateName: tray.get(chair.id) ?? null,
    checklist: checklist[chair.id] ?? [],
    preparedAt: prepared.get(chair.id)?.preparedAt?.toISOString() ?? null,
    preparedByStaffId: prepared.get(chair.id)?.preparedByStaffId ?? null,
  }));
}
