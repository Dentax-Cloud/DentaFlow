import { UserRole } from "@prisma/client";
import { createAuditLog } from "@/lib/actions/safe-action";
import { AuditAction } from "@prisma/client";

/** Dentist/specialist (DOCTOR/DENTIST) or admin/manager/owner may override pre-auth. */
export function canOverridePreAuth(role: UserRole | null | undefined): boolean {
  if (!role) return false;
  switch (role) {
    case UserRole.DENTIST:
    case UserRole.DOCTOR:
    case UserRole.ADMIN:
    case UserRole.MANAGER:
    case UserRole.OWNER:
      return true;
    default:
      return false;
  }
}

export type OverridePreAuthInput = {
  tenantId: string;
  userId: string;
  role: UserRole;
  encounterId: string;
  insuranceVerificationId?: string;
  reason: string;
};

/**
 * Role-scoped pre-auth override. Mandatory reason + audit log. Does not mutate
 * eligibility status by itself — callers apply the verification update after.
 */
export async function overridePreAuthGate(
  input: OverridePreAuthInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, error: "A reason is required to override pre-authorization." };
  }
  if (!canOverridePreAuth(input.role)) {
    return {
      ok: false,
      error: "Only dentists/specialists or admin/manager roles may override pre-authorization.",
    };
  }

  await createAuditLog({
    tenantId: input.tenantId,
    userId: input.userId,
    action: AuditAction.PERMISSION_CHANGE,
    entity: "InsuranceVerification",
    entityId: input.insuranceVerificationId ?? input.encounterId,
    metadata: {
      override: "pre_auth",
      encounterId: input.encounterId,
      reason,
      role: input.role,
    },
  });

  return { ok: true };
}
