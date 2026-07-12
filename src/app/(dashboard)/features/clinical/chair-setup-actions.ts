"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { StockTransactionType } from "@prisma/client";
import { createNotification } from "@/lib/notifications/notification-service";
import { generateStockRef } from "@/lib/ids/generate-ids";
import type { SetupItem, TrayTemplateItem } from "@/lib/chair-setup/types";
import { defaultColorForType, inferTrayCategory } from "@/lib/chair-setup/helpers";

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

async function resolveDoctorRecordId(staffMemberId: string, tenantId: string) {
  const doctor = await db.doctor.findFirst({
    where: { tenantId, userId: staffMemberId },
    select: { id: true },
  });
  return doctor?.id ?? null;
}

// ── Day session ───────────────────────────────────────────────

export async function getTodaySession() {
  const ctx = await requireTenantContext();
  const today = todayIso();

  return db.daySession.findFirst({
    where: { tenantId: ctx.tenantId, sessionDate: today, branchId: null },
    include: {
      chairSetups: {
        include: {
          chair: {
            select: {
              id: true,
              name: true,
              number: true,
              chairType: true,
              roomName: true,
              colorCode: true,
              status: true,
            },
          },
          template: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function openDaySession(notes?: string) {
  const ctx = await requireTenantContext();
  const today = todayIso();

  const existing = await db.daySession.findFirst({
    where: { tenantId: ctx.tenantId, sessionDate: today, branchId: null },
  });

  if (existing?.status === "OPEN") {
    throw new Error("Day session already open");
  }

  const session = existing
    ? await db.daySession.update({
        where: { id: existing.id },
        data: {
          openedAt: new Date(),
          openedById: ctx.staffMember?.id ?? null,
          status: "OPEN",
          notes: notes ?? existing.notes,
          closedAt: null,
          closedById: null,
        },
      })
    : await db.daySession.create({
        data: {
          id: randomUUID(),
          tenantId: ctx.tenantId,
          sessionDate: today,
          openedAt: new Date(),
          openedById: ctx.staffMember?.id ?? null,
          status: "OPEN",
          notes: notes ?? null,
        },
      });

  revalidatePath("/clinical/chair-setup");
  return session;
}

export async function closeDaySession(sessionId: string) {
  const ctx = await requireTenantContext();

  const session = await db.daySession.findFirst({
    where: { id: sessionId, tenantId: ctx.tenantId },
    include: { chairSetups: true },
  });
  if (!session) throw new Error("Session not found");
  if (session.status !== "OPEN") throw new Error("Session is not open");

  const summary = {
    totalSetups: session.chairSetups.length,
    totalSetupCost: session.chairSetups.reduce((sum, s) => sum + Number(s.setupCost), 0),
    chairSummaries: session.chairSetups.map((s) => ({
      chairId: s.chairId,
      setupItems: (s.setupItems as SetupItem[]).length,
      consumedItems: (s.consumedItems as SetupItem[]).length,
      returnedItems: (s.returnedItems as { inventoryItemId: string; qty: number }[]).length,
      cost: Number(s.setupCost),
    })),
    closedAt: new Date().toISOString(),
  };

  await db.daySession.update({
    where: { id: sessionId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: ctx.staffMember?.id ?? null,
      summary,
    },
  });

  await db.chairDaySetup.updateMany({
    where: { daySessionId: sessionId, tenantId: ctx.tenantId, status: "ACTIVE" },
    data: { status: "CLOSED" },
  });

  revalidatePath("/clinical/chair-setup");
  return { summary };
}

// ── Doctor-Chair schedule ─────────────────────────────────────

export async function getDoctorChairSchedule(date?: string) {
  const ctx = await requireTenantContext();
  const targetDate = date ?? todayIso();

  return db.doctorChairSchedule.findMany({
    where: { tenantId: ctx.tenantId, scheduleDate: targetDate },
    include: {
      chair: {
        select: {
          id: true,
          name: true,
          number: true,
          chairType: true,
          roomName: true,
          colorCode: true,
          status: true,
        },
      },
    },
    orderBy: [{ chairId: "asc" }, { startTime: "asc" }],
  });
}

export async function assignDoctorToChair(input: {
  chairId: string;
  doctorId: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  shiftType: string;
}) {
  const ctx = await requireTenantContext();

  const conflict = await db.doctorChairSchedule.findFirst({
    where: {
      tenantId: ctx.tenantId,
      doctorId: input.doctorId,
      scheduleDate: input.scheduleDate,
      NOT: { chairId: input.chairId },
      startTime: { lte: input.endTime },
      endTime: { gte: input.startTime },
    },
  });

  if (conflict) {
    throw new Error("Doctor already assigned to another chair at this time");
  }

  const schedule = await db.doctorChairSchedule.create({
    data: {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      chairId: input.chairId,
      doctorId: input.doctorId,
      scheduleDate: input.scheduleDate,
      startTime: input.startTime,
      endTime: input.endTime,
      shiftType: input.shiftType,
      status: "SCHEDULED",
    },
  });

  const [doctor, chair] = await Promise.all([
    db.staffMember.findFirst({
      where: { id: input.doctorId, tenantId: ctx.tenantId },
      select: { id: true, firstName: true, email: true },
    }),
    db.chair.findFirst({
      where: { id: input.chairId, tenantId: ctx.tenantId },
      select: { name: true },
    }),
  ]);

  if (doctor) {
    await createNotification({
      tenantId: ctx.tenantId,
      recipientId: doctor.id,
      type: "CHAIR_READY",
      title: "Chair assignment",
      body: `You are assigned to ${chair?.name ?? "a chair"} on ${new Date(input.scheduleDate).toLocaleDateString("en-AE", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })} (${input.startTime} – ${input.endTime})`,
      link: "/clinical/chair-setup",
      channel: "BOTH",
      emailTo: doctor.email ?? undefined,
    });
  }

  revalidatePath("/clinical/chair-setup");
  return schedule;
}

// ── Chair management ──────────────────────────────────────────

export async function updateChair(
  chairId: string,
  input: {
    name: string;
    number: number;
    roomName?: string | null;
    chairType: string;
    colorCode: string;
    equipment?: string[];
    status: string;
  },
) {
  const ctx = await requireTenantContext();
  if (!["OWNER", "ADMIN"].includes(ctx.staffMember?.role ?? "")) {
    throw new Error("Insufficient permissions");
  }

  const existing = await db.chair.findFirst({
    where: { id: chairId, tenantId: ctx.tenantId },
  });
  if (!existing) throw new Error("Chair not found");

  const chair = await db.chair.update({
    where: { id: chairId },
    data: {
      name: input.name,
      number: input.number,
      roomName: input.roomName ?? null,
      chairType: input.chairType,
      colorCode: input.colorCode || defaultColorForType(input.chairType),
      equipment: input.equipment ?? [],
      status: input.status,
      isActive: input.status === "ACTIVE",
    },
  });

  revalidatePath("/clinical/chair-setup");
  return chair;
}

export async function createChair(input: {
  branchId: string;
  name: string;
  number: number;
  roomName?: string | null;
  chairType: string;
  colorCode: string;
  equipment?: string[];
  status?: string;
}) {
  const ctx = await requireTenantContext();
  if (!["OWNER", "ADMIN"].includes(ctx.staffMember?.role ?? "")) {
    throw new Error("Insufficient permissions");
  }

  const chair = await db.chair.create({
    data: {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      branchId: input.branchId,
      name: input.name,
      number: input.number,
      roomName: input.roomName ?? null,
      chairType: input.chairType,
      colorCode: input.colorCode || defaultColorForType(input.chairType),
      equipment: input.equipment ?? [],
      status: input.status ?? "ACTIVE",
      isActive: (input.status ?? "ACTIVE") === "ACTIVE",
    },
  });

  revalidatePath("/clinical/chair-setup");
  return chair;
}

export async function removeDoctorChairAssignment(scheduleId: string) {
  const ctx = await requireTenantContext();

  await db.doctorChairSchedule.deleteMany({
    where: { id: scheduleId, tenantId: ctx.tenantId },
  });

  revalidatePath("/clinical/chair-setup");
}

// ── Tray templates ────────────────────────────────────────────

export async function getTrayTemplates() {
  const ctx = await requireTenantContext();
  return db.chairTrayTemplate.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function createTrayTemplate(input: {
  name: string;
  isDefault: boolean;
  items: TrayTemplateItem[];
  notes?: string;
}) {
  const ctx = await requireTenantContext();

  if (input.isDefault) {
    await db.chairTrayTemplate.updateMany({
      where: { tenantId: ctx.tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const template = await db.chairTrayTemplate.create({
    data: {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      name: input.name,
      isDefault: input.isDefault,
      items: input.items,
      notes: input.notes ?? null,
    },
  });

  revalidatePath("/clinical/chair-setup");
  return template;
}

export async function updateTrayTemplate(
  templateId: string,
  input: {
    name: string;
    isDefault: boolean;
    items: TrayTemplateItem[];
    notes?: string;
  },
) {
  const ctx = await requireTenantContext();

  const existing = await db.chairTrayTemplate.findFirst({
    where: { id: templateId, tenantId: ctx.tenantId },
  });
  if (!existing) throw new Error("Template not found");

  if (input.isDefault) {
    await db.chairTrayTemplate.updateMany({
      where: { tenantId: ctx.tenantId, isDefault: true, NOT: { id: templateId } },
      data: { isDefault: false },
    });
  }

  const template = await db.chairTrayTemplate.update({
    where: { id: templateId },
    data: {
      name: input.name,
      isDefault: input.isDefault,
      items: input.items,
      notes: input.notes ?? null,
    },
  });

  revalidatePath("/clinical/chair-setup");
  return template;
}

export async function deleteTrayTemplate(templateId: string) {
  const ctx = await requireTenantContext();

  await db.chairTrayTemplate.deleteMany({
    where: { id: templateId, tenantId: ctx.tenantId },
  });

  revalidatePath("/clinical/chair-setup");
}

// ── Chair day setup ───────────────────────────────────────────

export async function setupChairForDay(input: {
  sessionId: string;
  chairId: string;
  doctorId?: string;
  templateId?: string;
  items: SetupItem[];
}) {
  const ctx = await requireTenantContext();

  const session = await db.daySession.findFirst({
    where: { id: input.sessionId, tenantId: ctx.tenantId, status: "OPEN" },
  });
  if (!session) throw new Error("No open day session");

  const existingSetup = await db.chairDaySetup.findFirst({
    where: {
      tenantId: ctx.tenantId,
      daySessionId: input.sessionId,
      chairId: input.chairId,
      status: "ACTIVE",
    },
  });
  if (existingSetup) {
    throw new Error("Chair already set up for today");
  }

  for (const item of input.items) {
    if (item.category === "EQUIPMENT") continue;
    const inv = await db.inventoryItem.findFirst({
      where: { id: item.inventoryItemId, tenantId: ctx.tenantId, deletedAt: null },
      select: { quantity: true, name: true },
    });
    if (!inv || inv.quantity < item.qty) {
      throw new Error(`Insufficient stock for ${item.itemName || inv?.name || "item"}`);
    }
  }

  let setupCost = 0;
  for (const item of input.items) {
    if (item.category === "EQUIPMENT") continue;
    const invItem = await db.inventoryItem.findFirst({
      where: { id: item.inventoryItemId, tenantId: ctx.tenantId },
      select: { cost: true },
    });
    setupCost += Number(invItem?.cost ?? 0) * item.qty;
  }

  const setup = await db.$transaction(async (tx) => {
    const created = await tx.chairDaySetup.create({
      data: {
        id: randomUUID(),
        tenantId: ctx.tenantId,
        chairId: input.chairId,
        daySessionId: input.sessionId,
        doctorId: input.doctorId ?? null,
        templateId: input.templateId ?? null,
        setupItems: input.items,
        setupCost,
        status: "ACTIVE",
      },
    });

    for (const item of input.items) {
      if (item.category === "EQUIPMENT") continue;

      const transactionRef = await generateStockRef(ctx.tenantId);

      await tx.inventoryItem.update({
        where: { id: item.inventoryItemId },
        data: { quantity: { decrement: item.qty } },
      });

      await tx.stockTransaction.create({
        data: {
          tenantId: ctx.tenantId,
          itemId: item.inventoryItemId,
          type: StockTransactionType.USAGE,
          quantity: item.qty,
          chairId: input.chairId,
          batchId: item.batchId ?? null,
          notes: `Chair setup: ${session.sessionDate}`,
          transactionRef,
          scanMethod: "MANUAL",
        },
      });
    }

    return created;
  });

  if (input.doctorId) {
    const [chair, doctor] = await Promise.all([
      db.chair.findFirst({
        where: { id: input.chairId, tenantId: ctx.tenantId },
        select: { name: true },
      }),
      db.staffMember.findFirst({
        where: { id: input.doctorId, tenantId: ctx.tenantId },
        select: { id: true, firstName: true, email: true },
      }),
    ]);

    if (doctor) {
      const doctorRecordId = await resolveDoctorRecordId(input.doctorId, ctx.tenantId);
      const todayApptCount = doctorRecordId
        ? await db.appointment.count({
            where: {
              tenantId: ctx.tenantId,
              doctorId: doctorRecordId,
              startTime: {
                gte: new Date(`${session.sessionDate}T00:00:00`),
                lt: new Date(`${session.sessionDate}T23:59:59`),
              },
              status: { notIn: ["CANCELED", "NO_SHOW"] },
            },
          })
        : 0;

      await createNotification({
        tenantId: ctx.tenantId,
        recipientId: doctor.id,
        type: "CHAIR_READY",
        title: "Your chair is ready",
        body: `${chair?.name ?? "Your chair"} has been set up for today.${
          todayApptCount > 0
            ? ` You have ${todayApptCount} appointment${todayApptCount > 1 ? "s" : ""} scheduled.`
            : " No appointments scheduled yet."
        }`,
        link: "/clinical/chair-setup",
        channel: "BOTH",
        emailTo: doctor.email ?? undefined,
      });
    }
  }

  revalidatePath("/clinical/chair-setup");
  return setup;
}

// ── Procedure auto-deduction ──────────────────────────────────

export async function deductProcedureConsumables(input: {
  procedureCode: string;
  chairId: string;
  appointmentId: string;
  patientId: string;
}) {
  const ctx = await requireTenantContext();

  const procedure = await db.procedureCatalog.findFirst({
    where: { tenantId: ctx.tenantId, code: input.procedureCode },
    select: { inventoryConsumption: true, name: true },
  });

  if (!procedure?.inventoryConsumption) return { deducted: 0 };

  let consumption: TrayTemplateItem[] = [];
  try {
    consumption = JSON.parse(procedure.inventoryConsumption) as TrayTemplateItem[];
  } catch {
    return { deducted: 0 };
  }

  if (!consumption.length) return { deducted: 0 };

  const today = todayIso();
  const chairSetup = await db.chairDaySetup.findFirst({
    where: {
      tenantId: ctx.tenantId,
      chairId: input.chairId,
      status: "ACTIVE",
      session: { sessionDate: today },
    },
  });

  let deducted = 0;

  for (const item of consumption) {
    const inventoryItem = await db.inventoryItem.findFirst({
      where: { id: item.inventoryItemId, tenantId: ctx.tenantId, deletedAt: null },
      select: { quantity: true, name: true },
    });

    if (!inventoryItem || inventoryItem.quantity < item.qty) {
      console.warn(`[ChairSetup] Insufficient stock for ${item.inventoryItemId}`);
      continue;
    }

    // Phase 6: idempotent per appointment + inventory item (prevents double USAGE)
    const alreadyDeducted = await db.stockTransaction.findFirst({
      where: {
        tenantId: ctx.tenantId,
        itemId: item.inventoryItemId,
        appointmentId: input.appointmentId,
        type: StockTransactionType.USAGE,
      },
      select: { id: true },
    });
    if (alreadyDeducted) {
      continue;
    }

    const transactionRef = await generateStockRef(ctx.tenantId);

    await db.inventoryItem.update({
      where: { id: item.inventoryItemId },
      data: { quantity: { decrement: item.qty } },
    });

    await db.stockTransaction.create({
      data: {
        tenantId: ctx.tenantId,
        itemId: item.inventoryItemId,
        type: StockTransactionType.USAGE,
        quantity: item.qty,
        chairId: input.chairId,
        appointmentId: input.appointmentId,
        patientId: input.patientId,
        notes: `Auto-deducted: ${procedure.name}`,
        transactionRef,
      },
    });

    if (chairSetup) {
      const consumed = [...((chairSetup.consumedItems as SetupItem[]) ?? [])];
      consumed.push({
        inventoryItemId: item.inventoryItemId,
        itemName: item.itemName,
        qty: item.qty,
        unit: item.unit,
        category: item.category ?? "CONSUMABLE",
      });

      await db.chairDaySetup.update({
        where: { id: chairSetup.id },
        data: { consumedItems: consumed },
      });

      const remaining = inventoryItem.quantity - item.qty;
      const setupItem = (chairSetup.setupItems as SetupItem[]).find(
        (s) => s.inventoryItemId === item.inventoryItemId,
      );
      const setupQty = setupItem?.qty ?? 0;

      if (remaining <= 1 && setupQty > 0) {
        const staff = await db.staffMember.findMany({
          where: {
            tenantId: ctx.tenantId,
            role: { in: ["RECEPTIONIST", "NURSE", "ADMIN", "OWNER"] },
            deletedAt: null,
          },
          select: { id: true },
          take: 3,
        });

        const chair = await db.chair.findFirst({
          where: { id: input.chairId, tenantId: ctx.tenantId },
          select: { name: true },
        });

        for (const s of staff) {
          await createNotification({
            tenantId: ctx.tenantId,
            recipientId: s.id,
            type: "CHAIR_LOW_STOCK",
            title: "Low chair stock",
            body: `${chair?.name ?? "Chair"}: ${inventoryItem.name} running low (${remaining} remaining)`,
            link: "/clinical/chair-setup",
            channel: "IN_APP",
          }).catch(() => null);
        }
      }
    }

    deducted++;
  }

  return { deducted };
}

// ── Day closing ───────────────────────────────────────────────

export async function returnChairItems(input: {
  chairSetupId: string;
  returnedItems: Array<{ inventoryItemId: string; qty: number }>;
}) {
  const ctx = await requireTenantContext();

  const setup = await db.chairDaySetup.findFirst({
    where: { id: input.chairSetupId, tenantId: ctx.tenantId },
  });
  if (!setup) throw new Error("Chair setup not found");

  await db.$transaction(async (tx) => {
    for (const item of input.returnedItems) {
      if (item.qty <= 0) continue;

      const setupItem = (setup.setupItems as SetupItem[]).find(
        (s) => s.inventoryItemId === item.inventoryItemId,
      );
      if (setupItem?.category === "EQUIPMENT") continue;

      const transactionRef = await generateStockRef(ctx.tenantId);

      await tx.inventoryItem.update({
        where: { id: item.inventoryItemId },
        data: { quantity: { increment: item.qty } },
      });

      await tx.stockTransaction.create({
        data: {
          tenantId: ctx.tenantId,
          itemId: item.inventoryItemId,
          type: StockTransactionType.RETURN,
          quantity: item.qty,
          chairId: setup.chairId,
          notes: "Chair return: day closing",
          transactionRef,
        },
      });
    }

    await tx.chairDaySetup.update({
      where: { id: input.chairSetupId },
      data: {
        returnedItems: input.returnedItems,
        status: "CLOSED",
      },
    });
  });

  revalidatePath("/clinical/chair-setup");
  return { success: true };
}

export async function getChairDaySummary(sessionId: string) {
  const ctx = await requireTenantContext();

  const session = await db.daySession.findFirst({
    where: { id: sessionId, tenantId: ctx.tenantId },
    include: {
      chairSetups: {
        include: {
          chair: { select: { name: true, number: true } },
        },
      },
    },
  });

  if (!session) throw new Error("Session not found");

  return session.chairSetups.map((setup) => {
    const setupItems = (setup.setupItems as SetupItem[]) ?? [];
    const consumedItems = (setup.consumedItems as SetupItem[]) ?? [];
    const returnedItems =
      (setup.returnedItems as Array<{ inventoryItemId: string; qty: number }>) ?? [];

    const totalSetupQty = setupItems.reduce((s, i) => s + i.qty, 0);
    const totalConsumedQty = consumedItems.reduce((s, i) => s + i.qty, 0);
    const totalReturnedQty = returnedItems.reduce((s, i) => s + i.qty, 0);
    const variance = totalSetupQty - totalConsumedQty - totalReturnedQty;

    return {
      chairSetupId: setup.id,
      chairId: setup.chairId,
      chairName: setup.chair.name,
      doctorId: setup.doctorId,
      setupCost: Number(setup.setupCost),
      setupItems,
      consumedItems,
      returnedItems,
      totalSetupQty,
      totalConsumedQty,
      totalReturnedQty,
      variance,
      hasVariance: variance !== 0,
      status: setup.status,
    };
  });
}
