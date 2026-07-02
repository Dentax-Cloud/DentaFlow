"use server";

import { z } from "zod";
import { createAction } from "@/lib/actions/safe-action";
import { requireSuperAdmin } from "@/lib/tenant/isolation";
import { approveTenant, rejectTenant } from "@/lib/tenant/approval";

export const approveTenantAction = createAction({
  schema: z.object({ tenantId: z.string(), notes: z.string().optional() }),
  permission: async (ctx) => {
    await requireSuperAdmin();
    void ctx;
  },
  handler: async (input, ctx) => {
    const tenant = await approveTenant(input.tenantId, ctx.authUserId, input.notes);
    return tenant;
  },
});

export const rejectTenantAction = createAction({
  schema: z.object({ tenantId: z.string(), notes: z.string().optional() }),
  permission: async (ctx) => {
    await requireSuperAdmin();
    void ctx;
  },
  handler: async (input, ctx) => {
    const tenant = await rejectTenant(input.tenantId, ctx.authUserId, input.notes);
    return tenant;
  },
});
