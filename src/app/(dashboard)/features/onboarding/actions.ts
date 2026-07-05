"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { createAction } from "@/lib/actions/safe-action";
import { SubscriptionPlan, subscriptionPlanSchema } from "@/lib/subscription/plan-types";
import { sendWelcomeEmail } from "@/lib/mail";
import { getDefaultTrialSubscriptionFields } from "@/lib/tenant/trial";
import { checkBranchLimit, requireActiveSubscription } from "@/lib/features/gate";
import { getStaffActor } from "@/lib/tenant/context";
import { formatAdminName } from "@/lib/auth/registration-schema";

const onboardingSchema = z.object({
  clinicName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  chairCount: z.number().min(1).max(50),
  doctors: z
    .array(
      z.object({
        firstName: z.string(),
        lastName: z.string(),
        specialty: z.string().optional(),
      }),
    )
    .optional(),
  plan: subscriptionPlanSchema.optional(),
});

export const completeOnboarding = createAction({
  schema: onboardingSchema,
  handler: async (input, ctx) => {
    const trialFields = getDefaultTrialSubscriptionFields();

    await db.tenant.update({
      where: { id: ctx.tenant.id },
      data: {
        name: input.clinicName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        city: input.city,
        country: input.country,
        timezone: input.timezone ?? ctx.tenant.timezone,
        subscriptionPlan: input.plan ?? SubscriptionPlan.STARTER,
        subscriptionStatus: trialFields.subscriptionStatus,
        trialEndsAt: ctx.tenant.trialEndsAt ?? trialFields.trialEndsAt,
        onboardingCompleted: true,
      },
    });

    const existingBranch = await db.branch.findFirst({
      where: { tenantId: ctx.tenant.id, isPrimary: true },
    });

    let branch = existingBranch;
    if (!branch) {
      await requireActiveSubscription();
      if (!ctx.isSuperAdmin) {
        await checkBranchLimit(ctx.tenant.id);
      }
      branch = await db.branch.create({
        data: {
          tenantId: ctx.tenant.id,
          name: "Main Office",
          address: input.address,
          phone: input.phone,
          isPrimary: true,
        },
      });
    }

    const existingChairs = await db.chair.count({ where: { tenantId: ctx.tenant.id } });
    if (existingChairs === 0) {
      for (let i = 1; i <= input.chairCount; i++) {
        await db.chair.create({
          data: {
            tenantId: ctx.tenant.id,
            branchId: branch.id,
            name: `Chair ${i}`,
            number: i,
          },
        });
      }
    }

    const adminName = formatAdminName(
      getStaffActor(ctx).firstName ?? "Clinic",
      getStaffActor(ctx).lastName ?? "Admin",
    );
    const recipient = input.email ?? getStaffActor(ctx).email;

    if (recipient) {
      await sendWelcomeEmail({
        to: recipient,
        clinicName: input.clinicName,
        adminName,
        trialDays: 14,
      }).catch((err) => console.error("[mail:welcome]", err));
    }

    return { success: true };
  },
});
