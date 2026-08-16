import { AuditAction, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/actions/safe-action";
import { AnaesthesiaCosignError } from "@/lib/encounter/errors";

export { AnaesthesiaCosignError };

/** Same clinical-responsibility set as pre-auth override — not NURSE. */
export function canCosignAnaesthesia(role: UserRole | null | undefined): boolean {
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

export function assertDistinctCosignProviders(params: {
  actorStaffId: string | null | undefined;
  cosignStaffId: string;
}): void {
  if (!params.actorStaffId) {
    throw new AnaesthesiaCosignError(
      "A signed-in provider must log the completion before a second provider can co-sign.",
    );
  }
  if (params.actorStaffId === params.cosignStaffId) {
    throw new AnaesthesiaCosignError(
      "The co-sign must be a different provider than the one logging completion.",
    );
  }
}

export type CosignCredentials = {
  email: string;
  password: string;
};

/**
 * Authenticate a second provider in the same tenant. Rejects missing credentials,
 * bad passwords, non-providers, and the same user as the actor.
 */
export async function authenticateCosignProvider(params: {
  tenantId: string;
  actorStaffId: string | null | undefined;
  credentials: CosignCredentials | null | undefined;
}): Promise<{ staffId: string; role: UserRole; authUserId: string }> {
  const email = params.credentials?.email?.trim().toLowerCase() ?? "";
  const password = params.credentials?.password ?? "";
  if (!email || !password) {
    throw new AnaesthesiaCosignError(
      "Anaesthesia/sedation completion requires a second provider to co-sign. No second provider is available.",
    );
  }

  const user = await db.auth_users.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) {
    throw new AnaesthesiaCosignError("Second provider credentials were not accepted.");
  }

  const bcrypt = await import("bcryptjs");
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AnaesthesiaCosignError("Second provider credentials were not accepted.");
  }

  const staff = await db.staffMember.findFirst({
    where: {
      tenantId: params.tenantId,
      authUserId: user.id,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true, role: true, authUserId: true },
  });
  if (!staff) {
    throw new AnaesthesiaCosignError("Second provider credentials were not accepted.");
  }
  if (!canCosignAnaesthesia(staff.role)) {
    throw new AnaesthesiaCosignError(
      "Co-sign requires an authenticated provider (doctor/dentist or clinic admin).",
    );
  }

  assertDistinctCosignProviders({
    actorStaffId: params.actorStaffId,
    cosignStaffId: staff.id,
  });

  if (params.actorStaffId) {
    const actor = await db.staffMember.findFirst({
      where: { id: params.actorStaffId, tenantId: params.tenantId },
      select: { authUserId: true },
    });
    if (actor?.authUserId && actor.authUserId === user.id) {
      throw new AnaesthesiaCosignError(
        "The co-sign must be a different provider than the one logging completion.",
      );
    }
  }

  return {
    staffId: staff.id,
    role: staff.role,
    authUserId: user.id,
  };
}

export async function auditAnaesthesiaCosign(params: {
  tenantId: string;
  lineId: string;
  encounterId: string;
  actorStaffId: string;
  cosignStaffId: string;
  userId?: string;
}): Promise<void> {
  await createAuditLog({
    tenantId: params.tenantId,
    userId: params.userId,
    action: AuditAction.PERMISSION_CHANGE,
    entity: "EncounterProcedureLine",
    entityId: params.lineId,
    metadata: {
      kind: "anaesthesia_cosign",
      encounterId: params.encounterId,
      actorStaffId: params.actorStaffId,
      cosignStaffId: params.cosignStaffId,
    },
  });
}
