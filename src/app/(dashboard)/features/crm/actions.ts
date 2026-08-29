"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CampaignChannel, CampaignStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { createAction } from "@/lib/actions/safe-action";
import { assertPlanFeature } from "@/lib/features/gate";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import { requireTenantContext } from "@/lib/tenant/context";
import { sendMail } from "@/lib/mail";
import { overdueRecallWhere } from "@/lib/recall/queue";
import type { CampaignAudience } from "./crm-types";

async function requireCrmPlan(ctx: Awaited<ReturnType<typeof import("@/lib/tenant/context").requireTenantContext>>) {
  await requirePermission(PERMISSIONS.crm.write);
  assertPlanFeature(ctx, "crm");
}

export async function getTargetPatients(
  audience: CampaignAudience | string | null | undefined,
) {
  const ctx = await requireTenantContext();
  const tenantId = ctx.tenantId;
  const base = { tenantId, deletedAt: null, email: { not: null } };
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  switch (audience) {
    case "ACTIVE_PATIENTS":
      return db.patient.findMany({
        where: {
          ...base,
          lastVisitAt: { gte: sixMonthsAgo },
        },
      });
    case "OVERDUE_RECALL": {
      const recalls = await db.recall.findMany({
        where: overdueRecallWhere(tenantId),
        include: { patient: true },
      });
      const seen = new Set<string>();
      return recalls
        .map((r) => r.patient)
        .filter((p) => p.email && !p.deletedAt && !seen.has(p.id) && seen.add(p.id));
    }
    case "INACTIVE":
      return db.patient.findMany({
        where: {
          ...base,
          OR: [{ lastVisitAt: null }, { lastVisitAt: { lt: sixMonthsAgo } }],
        },
      });
    case "ALL_PATIENTS":
    default:
      return db.patient.findMany({ where: base });
  }
}

export async function countCampaignAudience(audience: CampaignAudience) {
  const patients = await getTargetPatients(audience);
  return patients.length;
}

const createCampaignSchema = z.object({
  name: z.string().min(1),
  channel: z.nativeEnum(CampaignChannel),
  targetAudience: z.string(),
  subject: z.string().optional(),
  body: z.string().min(1),
  scheduledAt: z.string().optional(),
});

export const createCampaign = createAction({
  schema: createCampaignSchema,
  permission: (ctx) => requireCrmPlan(ctx),
  handler: async (input, ctx) => {
    const campaign = await db.campaign.create({
      data: {
        tenantId: ctx.tenant.id,
        name: input.name,
        channel: input.channel,
        targetAudience: input.targetAudience,
        subject: input.subject,
        body: input.body,
        status: input.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      },
    });
    revalidatePath("/crm");
    return campaign;
  },
});

export const sendCampaign = createAction({
  schema: z.object({ campaignId: z.string() }),
  permission: (ctx) => requireCrmPlan(ctx),
  handler: async (input, ctx) => {
    const campaign = await db.campaign.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.campaignId }),
    });
    if (!campaign) throw new Error("Campaign not found");

    const patients = await getTargetPatients(campaign.targetAudience);
    let sent = 0;

    for (const patient of patients) {
      if (!patient.email) continue;
      if (campaign.channel === CampaignChannel.EMAIL) {
        await sendMail({
          to: patient.email,
          subject: campaign.subject ?? campaign.name,
          text: campaign.body,
        });
      }
      await db.communicationLog.create({
        data: {
          tenantId: ctx.tenant.id,
          patientId: patient.id,
          channel: campaign.channel,
          subject: campaign.name,
          body: campaign.body,
          status: "sent",
          campaignId: campaign.id,
        },
      });
      sent++;
    }

    await db.campaign.update({
      where: { id: campaign.id },
      data: {
        status: CampaignStatus.COMPLETED,
        sentAt: new Date(),
        sentCount: sent,
        recipientCount: patients.length,
      },
    });

    revalidatePath("/crm");
    return { sent, total: patients.length };
  },
});

const recallActionSchema = z.object({ recallId: z.string() });

export const markRecallComplete = createAction({
  schema: recallActionSchema,
  permission: (ctx) => requireCrmPlan(ctx),
  handler: async (input, ctx) => {
    const recall = await db.recall.update({
      where: { id: input.recallId, tenantId: ctx.tenant.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    revalidatePath("/crm");
    revalidatePath("/crm/recalls");
    return recall;
  },
});

export const sendRecallReminder = createAction({
  schema: recallActionSchema,
  permission: (ctx) => requireCrmPlan(ctx),
  handler: async (input, ctx) => {
    const recall = await db.recall.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.recallId }),
      include: { patient: true, tenant: true },
    });
    if (!recall?.patient.email) throw new Error("Patient has no email");

    await sendMail({
      to: recall.patient.email,
      subject: "Time for your dental checkup",
      text: `Dear ${recall.patient.firstName}, it's time for your routine dental checkup at ${recall.tenant.name}. Please call us to schedule your appointment.`,
    });

    const updated = await db.recall.update({
      where: { id: recall.id },
      data: { reminderSentAt: new Date() },
    });
    revalidatePath("/crm/recalls");
    return updated;
  },
});
