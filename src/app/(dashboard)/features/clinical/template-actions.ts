"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import {
  renderTemplateContent,
  parseSoapSections,
  plainTextToHtml,
  type TemplateVariables,
} from "@/lib/clinical/render-template";
import { PLATFORM_DEFAULT_TEMPLATES } from "@/lib/clinical/default-templates";
import {
  clinicalTemplateInputSchema,
  updateClinicalTemplateSchema,
  templateIdSchema,
  listTemplatesSchema,
  renderTemplateSchema,
  createNoteFromTemplateSchema,
} from "./note-schemas";

async function requireStaffId(ctx: Awaited<ReturnType<typeof import("@/lib/tenant/context").requireTenantContext>>) {
  const staffId = ctx.staffMember?.id;
  if (!staffId) throw new Error("Staff profile required");
  return staffId;
}

export async function seedPlatformTemplates() {
  const count = await db.clinicalTemplate.count({ where: { tenantId: null } });
  if (count > 0) return;

  await db.clinicalTemplate.createMany({
    data: PLATFORM_DEFAULT_TEMPLATES.map((t) => ({
      tenantId: null,
      name: t.name,
      type: t.type,
      content: t.content,
      isDefault: t.isDefault ?? false,
      isActive: true,
    })),
  });
}

export async function seedClinicalTemplatesForTenant(tenantId: string) {
  const existing = await db.clinicalTemplate.count({
    where: { tenantId },
  });
  if (existing > 0) return;

  await db.clinicalTemplate.createMany({
    data: PLATFORM_DEFAULT_TEMPLATES.map((t) => ({
      tenantId,
      name: t.name,
      type: t.type,
      content: t.content,
      isDefault: t.isDefault ?? false,
      isActive: true,
    })),
  });
}

export const listTemplates = createAction({
  schema: listTemplatesSchema,
  permission: () => requirePermission(PERMISSIONS.clinical_chart.read),
  handler: async (input, ctx) => {
    await seedPlatformTemplates();
    await seedClinicalTemplatesForTenant(ctx.tenant.id);

    const templates = await db.clinicalTemplate.findMany({
      where: {
        OR: [{ tenantId: ctx.tenant.id }, { tenantId: null }],
        isActive: true,
        ...(input.type ? { type: input.type } : {}),
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      content: t.content,
      isDefault: t.isDefault,
      isTenantOwned: t.tenantId === ctx.tenant.id,
    }));
  },
});

export const createTemplate = createAction({
  schema: clinicalTemplateInputSchema,
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    if (input.isDefault) {
      await db.clinicalTemplate.updateMany({
        where: { tenantId: ctx.tenant.id, type: input.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await db.clinicalTemplate.create({
      data: {
        tenantId: ctx.tenant.id,
        name: input.name,
        type: input.type,
        content: input.content,
        isDefault: input.isDefault ?? false,
        isActive: input.isActive ?? true,
      },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user?.id,
      action: "CREATE",
      entity: "ClinicalTemplate",
      entityId: template.id,
      metadata: { name: template.name, type: template.type },
    });

    revalidatePath("/admin/clinical-templates");
    return template;
  },
});

export const updateTemplate = createAction({
  schema: updateClinicalTemplateSchema,
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const existing = await db.clinicalTemplate.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.id }),
    });
    if (!existing) throw new Error("Template not found");

    if (input.isDefault) {
      await db.clinicalTemplate.updateMany({
        where: {
          tenantId: ctx.tenant.id,
          type: input.type ?? existing.type,
          isDefault: true,
          id: { not: input.id },
        },
        data: { isDefault: false },
      });
    }

    const template = await db.clinicalTemplate.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    revalidatePath("/admin/clinical-templates");
    return template;
  },
});

export const deleteTemplate = createAction({
  schema: templateIdSchema,
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const existing = await db.clinicalTemplate.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.id }),
    });
    if (!existing) throw new Error("Template not found");

    await db.clinicalTemplate.update({
      where: { id: input.id },
      data: { isActive: false },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user?.id,
      action: "DELETE",
      entity: "ClinicalTemplate",
      entityId: input.id,
    });

    revalidatePath("/admin/clinical-templates");
    return { ok: true };
  },
});

export const clonePlatformTemplate = createAction({
  schema: templateIdSchema,
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const source = await db.clinicalTemplate.findFirst({
      where: { id: input.id, tenantId: null },
    });
    if (!source) throw new Error("Platform template not found");

    const clone = await db.clinicalTemplate.create({
      data: {
        tenantId: ctx.tenant.id,
        name: `${source.name} (Copy)`,
        type: source.type,
        content: source.content,
        isDefault: false,
        isActive: true,
      },
    });

    revalidatePath("/admin/clinical-templates");
    return clone;
  },
});

export const renderTemplate = createAction({
  schema: renderTemplateSchema,
  permission: () => requirePermission(PERMISSIONS.clinical_chart.read),
  handler: async (input, ctx) => {
    const template = await db.clinicalTemplate.findFirst({
      where: {
        id: input.templateId,
        OR: [{ tenantId: ctx.tenant.id }, { tenantId: null }],
        isActive: true,
      },
    });
    if (!template) throw new Error("Template not found");

    const rendered = renderTemplateContent(
      template.content,
      (input.variables ?? {}) as TemplateVariables,
    );

    return {
      rendered,
      html: plainTextToHtml(rendered),
      soap: parseSoapSections(rendered),
      templateType: template.type,
    };
  },
});

export const createNoteFromTemplate = createAction({
  schema: createNoteFromTemplateSchema,
  permission: () => requirePermission(PERMISSIONS.clinical_chart.write),
  handler: async (input, ctx) => {
    const providerId = await requireStaffId(ctx);

    const patient = await db.patient.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.patientId, deletedAt: null }),
    });
    if (!patient) throw new Error("Patient not found");

    const template = await db.clinicalTemplate.findFirst({
      where: {
        id: input.templateId,
        OR: [{ tenantId: ctx.tenant.id }, { tenantId: null }],
        isActive: true,
      },
    });
    if (!template) throw new Error("Template not found");

    const rendered = renderTemplateContent(
      template.content,
      (input.variables ?? {}) as TemplateVariables,
    );
    const soap = parseSoapSections(rendered);
    const bodyHtml = plainTextToHtml(rendered);
    const providerName = ctx.staffMember
      ? `${ctx.staffMember.firstName} ${ctx.staffMember.lastName}`.trim()
      : "Provider";

    const note = await db.clinicalNote.create({
      data: {
        tenantId: ctx.tenant.id,
        patientId: input.patientId,
        providerId,
        appointmentId: input.appointmentId,
        templateId: template.id,
        noteType: template.type,
        title: template.name,
        subjective: soap.subjective || null,
        objective: soap.objective || rendered,
        assessment: soap.assessment || null,
        plan: soap.plan || null,
        bodyHtml,
        rawNotes: rendered,
        toothNumbers: input.toothNumbers ?? [],
        signedAt: new Date(),
        signedByName: providerName,
        versions: {
          create: {
            tenantId: ctx.tenant.id,
            version: 1,
            subjective: soap.subjective || null,
            objective: soap.objective || rendered,
            assessment: soap.assessment || null,
            plan: soap.plan || null,
            bodyHtml,
            rawNotes: rendered,
            editedById: ctx.user?.id,
            editedByName: providerName,
          },
        },
      },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user?.id,
      action: "CREATE",
      entity: "ClinicalNote",
      entityId: note.id,
      metadata: { templateId: template.id, fromTemplate: true },
    });

    revalidatePath("/clinical");
    revalidatePath(`/patients/${input.patientId}`);
    return note;
  },
});
