import { LimitExceededError } from "@/lib/features/gate";
import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { AuditAction } from "@prisma/client";

let testTenantContext: Awaited<ReturnType<typeof requireTenantContext>> | null = null;

export function __setTestTenantContext(
  ctx: NonNullable<Awaited<ReturnType<typeof requireTenantContext>>>,
) {
  testTenantContext = ctx;
}

export function __clearTestTenantContext() {
  testTenantContext = null;
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function actionError(message: string): ActionResult<never> {
  return { success: false, error: message };
}

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export async function createAuditLog(params: {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      performedById: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      metadata: params.metadata ?? undefined,
    },
  });
}

export function createAction<TInput, TOutput>(config: {
  schema: ZodSchema<TInput>;
  permission?: (ctx: Awaited<ReturnType<typeof requireTenantContext>>) => Promise<void>;
  handler: (
    input: TInput,
    ctx: Awaited<ReturnType<typeof requireTenantContext>>,
  ) => Promise<TOutput>;
}) {
  return async (rawInput: TInput): Promise<ActionResult<TOutput>> => {
    try {
      const parsed = config.schema.safeParse(rawInput);
      if (!parsed.success) {
        return actionError(parsed.error.errors[0]?.message ?? "Validation failed");
      }

      const ctx =
        process.env.NODE_ENV === "test" && testTenantContext
          ? testTenantContext
          : await requireTenantContext();
      if (config.permission) {
        await config.permission(ctx);
      }

      const data = await config.handler(parsed.data, ctx);
      return actionSuccess(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      if (message === "UNAUTHORIZED") return actionError("Please sign in");
      if (message === "FORBIDDEN") return actionError("You do not have permission");
      if (message === "FEATURE_NOT_AVAILABLE")
        return actionError("Upgrade your plan to use this feature");
      if (message === "SUBSCRIPTION_INACTIVE")
        return actionError("Your subscription is inactive. Please update billing.");
      if (e instanceof LimitExceededError) {
        return actionError(
          `${e.resource} limit reached (${e.current}/${e.limit}). Upgrade your plan in billing.`,
        );
      }
      if (message === "TENANT_PENDING_APPROVAL")
        return actionError("Your clinic is pending approval");
      if (message === "TENANT_NOT_ACTIVE")
        return actionError("Your clinic is not active");
      if (message === "Patient not found")
        return actionError("This patient was not found in your clinic.");
      if (e instanceof Error && message.length > 0 && message.length < 200) {
        return actionError(message);
      }
      console.error("[action]", message);
      return actionError("Something went wrong. Please try again.");
    }
  };
}
