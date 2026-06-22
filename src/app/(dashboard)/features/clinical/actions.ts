"use server";



import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

import { createAction } from "@/lib/actions/safe-action";

import { requirePermission } from "@/lib/rbac/guard";

import { requireFeature } from "@/lib/features/gate";

import { PERMISSIONS } from "@/lib/rbac/permissions";

import { tenantWhere } from "@/lib/tenant/scoped";

import { generateClinicalNotes, suggestTreatmentPlan } from "@/lib/ai";

import type { ToothChartData } from "@/lib/clinical/chart-types";


import {

  saveToothConditionSchema,

  removeToothConditionSchema,

  saveClinicalNoteSchema,

  generateSoapSchema,

  loadPatientChartSchema,

  saveTreatmentPlanSchema,

} from "./schemas";

import { z } from "zod";



async function requirePatientInTenant(tenantId: string, patientId: string) {

  const patient = await db.patient.findFirst({

    where: tenantWhere(tenantId, { id: patientId, deletedAt: null }),

  });

  if (!patient) throw new Error("Patient not found");

  return patient;

}



function buildChartData(

  teeth: Awaited<ReturnType<typeof getPatientChart>>,

): ToothChartData {

  const data: ToothChartData = {};

  for (const tooth of teeth) {

    if (tooth.conditions.length === 0) continue;

    data[tooth.number] = {

      conditions: tooth.conditions.map((c) => ({

        id: c.id,

        type: c.type,

        surfaces: c.surfaces,

        severity: c.severity,

        notes: c.notes,

        recordedAt: c.recordedAt.toISOString(),

      })),

    };

  }

  return data;

}



export const loadPatientChart = createAction({

  schema: loadPatientChartSchema,

  permission: () => requirePermission(PERMISSIONS.clinical.read),

  handler: async (input, ctx) => {

    await requirePatientInTenant(ctx.tenant.id, input.patientId);

    const teeth = await getPatientChart(ctx.tenant.id, input.patientId);

    return buildChartData(teeth);

  },

});



export const saveToothCondition = createAction({

  schema: saveToothConditionSchema,

  permission: () => requirePermission(PERMISSIONS.clinical.write),

  handler: async (input, ctx) => {

    await requirePatientInTenant(ctx.tenant.id, input.patientId);



    let tooth = await db.tooth.findUnique({

      where: {

        tenantId_patientId_number: {

          tenantId: ctx.tenant.id,

          patientId: input.patientId,

          number: input.toothNumber,

        },

      },

    });



    if (!tooth) {

      tooth = await db.tooth.create({

        data: {

          tenantId: ctx.tenant.id,

          patientId: input.patientId,

          number: input.toothNumber,

        },

      });

    }



    const condition = await db.toothCondition.create({

      data: {

        tenantId: ctx.tenant.id,

        patientId: input.patientId,

        toothId: tooth.id,

        type: input.type,

        surfaces: input.surfaces ?? [],

        severity: input.severity,

        mobility: input.mobility,

        pocketDepth: input.pocketDepth,

        notes: input.notes,

        recordedBy: ctx.user.id,

      },

    });



    return {

      id: condition.id,

      type: condition.type,

      surfaces: condition.surfaces,

      severity: condition.severity,

      notes: condition.notes,

      recordedAt: condition.recordedAt.toISOString(),

      toothNumber: input.toothNumber,

    };

  },

});



export const removeToothCondition = createAction({

  schema: removeToothConditionSchema,

  permission: () => requirePermission(PERMISSIONS.clinical.write),

  handler: async (input, ctx) => {

    await requirePatientInTenant(ctx.tenant.id, input.patientId);



    const condition = await db.toothCondition.findFirst({

      where: {

        id: input.conditionId,

        tenantId: ctx.tenant.id,

        patientId: input.patientId,

      },

      include: { tooth: true },

    });

    if (!condition) throw new Error("Condition not found");



    await db.toothCondition.delete({ where: { id: condition.id } });

    return { toothNumber: condition.tooth.number };

  },

});



export const saveClinicalNote = createAction({

  schema: saveClinicalNoteSchema,

  permission: () => requirePermission(PERMISSIONS.clinical.write),

  handler: async (input, ctx) => {

    await requirePatientInTenant(ctx.tenant.id, input.patientId);



    return db.clinicalNote.create({

      data: {

        tenantId: ctx.tenant.id,

        patientId: input.patientId,

        providerId: ctx.user.id,

        rawNotes: input.rawNotes,

        subjective: input.subjective,

        objective: input.objective,

        assessment: input.assessment,

        plan: input.plan,

        aiGenerated: input.aiGenerated ?? false,

      },

    });

  },

});



export const generateSoapNote = createAction({

  schema: generateSoapSchema,

  permission: async () => {

    await requireFeature("aiEnabled");

    return requirePermission(PERMISSIONS.ai.use);

  },

  handler: async (input) => {

    const parts: string[] = [];

    if (input.rawNotes?.trim()) parts.push(`Clinician notes:\n${input.rawNotes.trim()}`);

    if (input.chartSummary?.trim()) parts.push(`Odontogram:\n${input.chartSummary.trim()}`);

    return generateClinicalNotes(parts.join("\n\n"));

  },

});



export const aiSuggestTreatment = createAction({

  schema: z.object({ patientId: z.string() }),

  permission: async () => {

    await requireFeature("aiEnabled");

    return requirePermission(PERMISSIONS.ai.use);

  },

  handler: async (input, ctx) => {

    const patient = await db.patient.findFirst({

      where: tenantWhere(ctx.tenant.id, { id: input.patientId }),

      include: {

        teeth: {

          include: { conditions: { orderBy: { recordedAt: "desc" } } },

        },

      },

    });

    if (!patient) throw new Error("Patient not found");



    const age = patient.dateOfBirth

      ? Math.floor(

          (Date.now() - patient.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),

        )

      : undefined;



    return suggestTreatmentPlan(

      { age, history: JSON.stringify(patient.dentalHistory) },

      {

        conditions: patient.teeth.flatMap((t) =>

          t.conditions.map((c) => ({ tooth: t.number, type: c.type })),

        ),

      },

    );

  },

});



export const saveSuggestedTreatmentPlan = createAction({

  schema: saveTreatmentPlanSchema,

  permission: () => requirePermission(PERMISSIONS.clinical.write),

  handler: async (input, ctx) => {

    await requirePatientInTenant(ctx.tenant.id, input.patientId);



    const totalCost = input.items.reduce((sum, i) => sum + i.estimatedCost, 0);



    const plan = await db.treatmentPlan.create({

      data: {

        tenantId: ctx.tenant.id,

        patientId: input.patientId,

        title: input.title,

        description: input.description,

        status: "PROPOSED",

        totalCost,

        aiSuggested: input.aiSuggested ?? true,

        items: {

          create: input.items.map((item) => ({

            tenantId: ctx.tenant.id,

            description: item.description,

            toothNumbers: item.toothNumbers,

            unitCost: item.estimatedCost,

            totalCost: item.estimatedCost,

            phase: item.phase,

          })),

        },

      },

      include: { items: true },

    });



    return plan;

  },

});



export async function getPatientChart(tenantId: string, patientId: string) {

  return db.tooth.findMany({

    where: { tenantId, patientId },

    include: { conditions: { orderBy: { recordedAt: "desc" } } },

  });

}

const generateInvoiceSchema = z.object({
  patientId: z.string(),
  appointmentId: z.string(),
  procedures: z.array(
    z.object({
      procedureId: z.string(),
      quantity: z.number().int().min(1).default(1),
    }),
  ).min(1),
});

export const generateInvoiceFromProcedures = createAction({
  schema: generateInvoiceSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    await requirePatientInTenant(ctx.tenant.id, input.patientId);

    const catalogItems = await db.procedureCatalog.findMany({
      where: {
        id: { in: input.procedures.map((p) => p.procedureId) },
        tenantId: ctx.tenant.id,
        isActive: true,
      },
    });

    if (catalogItems.length === 0) throw new Error("No valid procedures selected");

    const count = await db.invoice.count({ where: { tenantId: ctx.tenant.id } });
    const { generateInvoiceNumber } = await import("@/lib/utils");

    const items = catalogItems.map((item) => {
      const qty = input.procedures.find((p) => p.procedureId === item.id)?.quantity ?? 1;
      const unitPrice = Number(item.price);
      return {
        tenantId: ctx.tenant.id,
        description: item.name,
        quantity: qty,
        unitPrice,
        total: unitPrice * qty,
        procedureCode: item.code,
      };
    });

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const settings = await db.settings.findUnique({ where: { tenantId: ctx.tenant.id } });
    const taxRate = settings?.taxRate ?? 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    const invoice = await db.invoice.create({
      data: {
        tenantId: ctx.tenant.id,
        patientId: input.patientId,
        invoiceNumber: generateInvoiceNumber(count + 1),
        status: "DRAFT",
        subtotal,
        tax,
        total,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: `Appointment ${input.appointmentId}`,
        items: { create: items },
      },
      include: { items: true },
    });

    await db.appointment.updateMany({
      where: tenantWhere(ctx.tenant.id, { id: input.appointmentId }),
      data: { status: "INVOICED" },
    });

    for (const catalogItem of catalogItems) {
      if (!catalogItem.inventoryConsumption) continue;
      let consumption: { inventoryItemId: string; quantity: number }[] = [];
      try {
        consumption = JSON.parse(catalogItem.inventoryConsumption);
      } catch {
        continue;
      }
      for (const { inventoryItemId, quantity } of consumption) {
        await db.inventoryItem.update({
          where: { id: inventoryItemId },
          data: { quantity: { decrement: quantity } },
        });
        await db.stockTransaction.create({
          data: {
            tenantId: ctx.tenant.id,
            itemId: inventoryItemId,
            type: "USAGE",
            quantity,
            notes: `Used in procedure: ${catalogItem.name}`,
          },
        });
      }
    }

    revalidatePath("/billing");
    revalidatePath("/clinical");
    revalidatePath("/appointments");
    revalidatePath("/inventory");
    return invoice;
  },
});

const createTreatmentPlanSchema = z.object({
  patientId: z.string(),
  title: z.string().min(1),
  notes: z.string().optional(),
});

export const createTreatmentPlan = createAction({
  schema: createTreatmentPlanSchema,
  permission: () => requirePermission(PERMISSIONS.clinical.write),
  handler: async (input, ctx) => {
    await requirePatientInTenant(ctx.tenant.id, input.patientId);
    const plan = await db.treatmentPlan.create({
      data: {
        tenantId: ctx.tenant.id,
        patientId: input.patientId,
        title: input.title,
        description: input.notes,
        status: "DRAFT",
      },
    });
    revalidatePath("/clinical");
    revalidatePath("/clinical/treatment-plans");
    return plan;
  },
});

const addTreatmentItemSchema = z.object({
  planId: z.string(),
  procedureCatalogId: z.string().optional(),
  toothNumber: z.string().optional(),
  description: z.string().min(1),
  estimatedCost: z.number().min(0),
  notes: z.string().optional(),
});

export const addTreatmentItem = createAction({
  schema: addTreatmentItemSchema,
  permission: () => requirePermission(PERMISSIONS.clinical.write),
  handler: async (input, ctx) => {
    const plan = await db.treatmentPlan.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.planId, deletedAt: null }),
    });
    if (!plan) throw new Error("Treatment plan not found");

    let description = input.description;
    let unitCost = input.estimatedCost;
    if (input.procedureCatalogId) {
      const proc = await db.procedureCatalog.findFirst({
        where: tenantWhere(ctx.tenant.id, { id: input.procedureCatalogId }),
      });
      if (proc) {
        description = proc.name;
        unitCost = Number(proc.price);
      }
    }

    const item = await db.treatmentItem.create({
      data: {
        tenantId: ctx.tenant.id,
        treatmentPlanId: input.planId,
        description,
        toothNumbers: input.toothNumber ? [input.toothNumber] : [],
        unitCost,
        totalCost: unitCost,
        status: "pending",
        procedureCode: input.procedureCatalogId,
      },
    });

    const items = await db.treatmentItem.findMany({
      where: { treatmentPlanId: input.planId },
    });
    const totalCost = items.reduce((s, i) => s + Number(i.totalCost), 0);
    await db.treatmentPlan.update({
      where: { id: input.planId },
      data: { totalCost },
    });

    revalidatePath(`/clinical/treatment-plans/${input.planId}`);
    return item;
  },
});

const updateTreatmentPlanStatusSchema = z.object({
  planId: z.string(),
  status: z.enum(["DRAFT", "PROPOSED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "DECLINED"]),
});

export const updateTreatmentPlanStatus = createAction({
  schema: updateTreatmentPlanStatusSchema,
  permission: () => requirePermission(PERMISSIONS.clinical.write),
  handler: async (input, ctx) => {
    const plan = await db.treatmentPlan.update({
      where: { id: input.planId, tenantId: ctx.tenant.id },
      data: {
        status: input.status,
        ...(input.status === "ACCEPTED" ? { acceptedAt: new Date() } : {}),
      },
    });
    revalidatePath("/clinical");
    revalidatePath(`/clinical/treatment-plans/${input.planId}`);
    return plan;
  },
});

export const removeTreatmentItem = createAction({
  schema: z.object({ itemId: z.string(), planId: z.string() }),
  permission: () => requirePermission(PERMISSIONS.clinical.write),
  handler: async (input, ctx) => {
    const item = await db.treatmentItem.findFirst({
      where: { id: input.itemId, tenantId: ctx.tenant.id, treatmentPlanId: input.planId },
    });
    if (!item) throw new Error("Item not found");

    await db.treatmentItem.delete({ where: { id: input.itemId } });

    const items = await db.treatmentItem.findMany({
      where: { treatmentPlanId: input.planId },
    });
    const totalCost = items.reduce((s, i) => s + Number(i.totalCost), 0);
    await db.treatmentPlan.update({
      where: { id: input.planId },
      data: { totalCost },
    });

    revalidatePath(`/clinical/treatment-plans/${input.planId}`);
    return { ok: true };
  },
});

const generateInvoiceFromPlanSchema = z.object({
  planId: z.string(),
});

export const generateInvoiceFromTreatmentPlan = createAction({
  schema: generateInvoiceFromPlanSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const plan = await db.treatmentPlan.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.planId, deletedAt: null }),
      include: { items: true, patient: true },
    });
    if (!plan) throw new Error("Treatment plan not found");

    const activeItems = plan.items.filter(
      (i) => !["completed", "declined"].includes(i.status.toLowerCase()),
    );
    if (activeItems.length === 0) throw new Error("No billable treatment items");

    const count = await db.invoice.count({ where: { tenantId: ctx.tenant.id } });
    const { generateInvoiceNumber } = await import("@/lib/utils");
    const settings = await db.settings.findUnique({ where: { tenantId: ctx.tenant.id } });
    const taxRate = settings?.taxRate ?? 0;

    const lineItems = activeItems.map((item) => ({
      tenantId: ctx.tenant.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitCost),
      total: Number(item.totalCost),
      procedureCode: item.procedureCode ?? undefined,
    }));

    const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    const invoice = await db.invoice.create({
      data: {
        tenantId: ctx.tenant.id,
        patientId: plan.patientId,
        invoiceNumber: generateInvoiceNumber(count + 1),
        status: "DRAFT",
        subtotal,
        tax,
        total,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: `Treatment plan: ${plan.title}`,
        items: { create: lineItems },
      },
      include: { items: true },
    });

    await db.treatmentItem.updateMany({
      where: { treatmentPlanId: plan.id, id: { in: activeItems.map((i) => i.id) } },
      data: { status: "completed" },
    });

    revalidatePath("/billing");
    revalidatePath(`/clinical/treatment-plans/${plan.id}`);
    return invoice;
  },
});

const scheduleFromPlanSchema = z.object({
  planId: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  title: z.string().optional(),
});

export const scheduleAppointmentFromPlan = createAction({
  schema: scheduleFromPlanSchema,
  permission: () => requirePermission(PERMISSIONS.appointments.write),
  handler: async (input, ctx) => {
    const plan = await db.treatmentPlan.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.planId, deletedAt: null }),
    });
    if (!plan) throw new Error("Treatment plan not found");

    const appointment = await db.appointment.create({
      data: {
        tenantId: ctx.tenant.id,
        patientId: plan.patientId,
        title: input.title ?? `Treatment: ${plan.title}`,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        notes: `Linked to treatment plan ${plan.id}`,
      },
    });

    if (plan.status === "DRAFT" || plan.status === "PROPOSED") {
      await db.treatmentPlan.update({
        where: { id: plan.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    revalidatePath("/appointments");
    revalidatePath(`/clinical/treatment-plans/${plan.id}`);
    return appointment;
  },
});

