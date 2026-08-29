import { AuditAction, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/actions/safe-action";
import {
  createClinicalAlertAudited,
  createEncounterProcedureBundleAudited,
  updateEncounterAudited,
  updateEncounterProcedureLineAudited,
} from "./repository";
import { assertProcedureStartGatesAllowed } from "./gate-enforcement";
import {
  resolveEncounterSpineSettings,
} from "./tenant-settings";
import type { EncounterProcedureLineStatus, PlannedVsPerformed } from "./types";
import { isProcedureLineTerminal } from "./state-machine";
import { treatmentItemIdsForWriteBack } from "./close-out";
import {
  ADD_LINE_DEDUP_WINDOW_MS,
  findRecentDuplicateAddLine,
} from "./add-line-dedup";

const LINE_TRANSITIONS: Record<
  EncounterProcedureLineStatus,
  EncounterProcedureLineStatus[]
> = {
  planned: ["in_progress", "declined"],
  in_progress: ["completed", "declined", "interrupted"],
  completed: [],
  declined: [],
  interrupted: ["completed", "declined"],
};

export async function addEncounterProcedureLine(params: {
  tenantId: string;
  encounterId: string;
  procedureCatalogId: string;
  treatmentItemId?: string | null;
  procedureBundleId?: string | null;
  toothNumbers?: string[];
  surfaces?: string[];
  plannedVsPerformed?: PlannedVsPerformed;
  providerId?: string | null;
  unitPrice?: number | null;
  userId?: string;
}) {
  const encounter = await db.encounter.findFirst({
    where: { id: params.encounterId, tenantId: params.tenantId, deletedAt: null },
  });
  if (!encounter) throw new Error("Encounter not found.");
  if (encounter.closedAt) throw new Error("Encounter is closed.");

  const catalog = await db.procedureCatalog.findFirst({
    where: {
      id: params.procedureCatalogId,
      tenantId: params.tenantId,
      isActive: true,
    },
  });
  if (!catalog) throw new Error("Procedure catalog entry not found.");

  let plannedVsPerformed: PlannedVsPerformed = params.plannedVsPerformed ?? "added";
  if (params.treatmentItemId) {
    const item = await db.treatmentItem.findFirst({
      where: {
        id: params.treatmentItemId,
        tenantId: params.tenantId,
        treatmentPlanId: encounter.treatmentPlanId ?? undefined,
      },
    });
    if (!item) throw new Error("Treatment item not found on linked plan.");
    plannedVsPerformed = params.plannedVsPerformed ?? "matched";
  }

  const toothNumbers = params.toothNumbers ?? [];
  const surfaces = params.surfaces ?? [];
  const intent = {
    procedureCatalogId: catalog.id,
    toothNumbers,
    surfaces,
  };

  const { row, created } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT id FROM "Encounter"
      WHERE id = ${params.encounterId}
        AND "tenantId" = ${params.tenantId}
        AND "deletedAt" IS NULL
      FOR UPDATE
    `;

    const recent = await tx.encounterProcedureLine.findMany({
      where: {
        tenantId: params.tenantId,
        encounterId: params.encounterId,
        procedureCatalogId: catalog.id,
        status: { not: "declined" },
        createdAt: { gte: new Date(Date.now() - ADD_LINE_DEDUP_WINDOW_MS) },
      },
    });
    const duplicate = findRecentDuplicateAddLine(recent, intent);
    if (duplicate) return { row: duplicate, created: false as const };

    const createdRow = await tx.encounterProcedureLine.create({
      data: {
        tenant: { connect: { id: params.tenantId } },
        encounter: { connect: { id: params.encounterId } },
        procedureCatalog: { connect: { id: catalog.id } },
        ...(params.treatmentItemId
          ? { treatmentItem: { connect: { id: params.treatmentItemId } } }
          : {}),
        ...(params.procedureBundleId
          ? { procedureBundle: { connect: { id: params.procedureBundleId } } }
          : {}),
        ...(params.providerId
          ? { provider: { connect: { id: params.providerId } } }
          : {}),
        toothNumbers,
        surfaces,
        plannedVsPerformed,
        status: "planned",
        unitPrice:
          params.unitPrice != null
            ? new Prisma.Decimal(params.unitPrice)
            : catalog.price,
      },
    });
    return { row: createdRow, created: true as const };
  });

  if (created) {
    await createAuditLog({
      tenantId: params.tenantId,
      userId: params.userId,
      action: AuditAction.CREATE,
      entity: "EncounterProcedureLine",
      entityId: row.id,
      metadata: { encounterId: row.encounterId, status: row.status },
    });
  }

  return row;
}

export async function createEncounterBundle(params: {
  tenantId: string;
  encounterId: string;
  name: string;
  userId?: string;
}) {
  const name = params.name.trim();
  if (!name) throw new Error("Bundle name is required.");
  return createEncounterProcedureBundleAudited(
    {
      tenant: { connect: { id: params.tenantId } },
      encounter: { connect: { id: params.encounterId } },
      name,
    },
    { tenantId: params.tenantId, userId: params.userId },
  );
}

export async function transitionProcedureLineStatus(params: {
  tenantId: string;
  lineId: string;
  toStatus: EncounterProcedureLineStatus;
  providerId?: string | null;
  userId?: string;
}) {
  const line = await db.encounterProcedureLine.findFirst({
    where: { id: params.lineId, tenantId: params.tenantId },
    include: { encounter: true },
  });
  if (!line) throw new Error("Procedure line not found.");
  if (line.encounter.deletedAt || line.encounter.closedAt) {
    throw new Error("Encounter is closed.");
  }

  const from = line.status as EncounterProcedureLineStatus;
  const allowed = LINE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(params.toStatus)) {
    throw new Error(`Illegal procedure line transition: ${from} → ${params.toStatus}`);
  }

  if (params.toStatus === "in_progress") {
    await assertProcedureStartGatesAllowed({
      tenantId: params.tenantId,
      encounterId: line.encounterId,
      procedureLineId: line.id,
    });
  }

  const data: Prisma.EncounterProcedureLineUpdateInput = {
    status: params.toStatus,
    ...(params.providerId
      ? { provider: { connect: { id: params.providerId } } }
      : {}),
  };
  if (params.toStatus === "in_progress" && !line.startedAt) {
    data.startedAt = new Date();
  }
  if (params.toStatus === "completed") {
    data.completedAt = new Date();
  }
  if (params.toStatus === "declined") {
    data.plannedVsPerformed = "declined";
    data.completedAt = new Date();
  }

  return updateEncounterProcedureLineAudited(line.id, params.tenantId, data, {
    userId: params.userId,
  });
}

export async function logSterilizationForLine(params: {
  tenantId: string;
  lineId: string;
  userId?: string;
}) {
  const line = await db.encounterProcedureLine.findFirst({
    where: { id: params.lineId, tenantId: params.tenantId },
  });
  if (!line) throw new Error("Procedure line not found.");
  return updateEncounterProcedureLineAudited(
    line.id,
    params.tenantId,
    { sterilizationLoggedAt: new Date() },
    { userId: params.userId },
  );
}

export async function logMaterialUsage(params: {
  tenantId: string;
  procedureLineId: string;
  itemId: string;
  tier: "tracked" | "consumable";
  quantity: number;
  isBillable?: boolean;
  lotNumber?: string | null;
  expiryDate?: Date | null;
  userId?: string;
}) {
  if (!(params.quantity > 0)) throw new Error("Quantity must be greater than zero.");

  const { logMaterialUsageWithStoreDeduction } = await import(
    "@/lib/inventory/deduct-store-stock"
  );
  return logMaterialUsageWithStoreDeduction(params);
}

export async function returnMaterialUsage(params: {
  tenantId: string;
  materialUsageId: string;
  userId?: string;
}) {
  const { returnMaterialUsageToStore } = await import(
    "@/lib/inventory/deduct-store-stock"
  );
  return returnMaterialUsageToStore(params);
}

export const PAIN_NEXT_ACTIONS = [
  "extra_anesthetic",
  "paused",
  "follow_up_flagged",
] as const;

export type PainNextAction = (typeof PAIN_NEXT_ACTIONS)[number];

export async function recordEncounterPainScore(params: {
  tenantId: string;
  encounterId: string;
  painScore: number;
  nextAction?: PainNextAction | null;
  userId?: string;
  staffMemberId?: string | null;
}) {
  if (params.painScore < 0 || params.painScore > 10) {
    throw new Error("Pain score must be between 0 and 10.");
  }

  const [settingsRow, tenant] = await Promise.all([
    db.settings.findUnique({
      where: { tenantId: params.tenantId },
      select: { encounterSpineSettings: true },
    }),
    db.tenant.findFirst({
      where: { id: params.tenantId },
      select: { featureFlags: true },
    }),
  ]);
  const settings = resolveEncounterSpineSettings({
    settingsJson: settingsRow?.encounterSpineSettings as Record<string, unknown> | null,
    featureFlags: tenant?.featureFlags as Record<string, unknown> | null,
  });

  const crosses = params.painScore >= settings.painScoreThreshold;
  if (crosses) {
    if (!params.nextAction || !(PAIN_NEXT_ACTIONS as readonly string[]).includes(params.nextAction)) {
      throw new Error(
        `Pain score ≥ ${settings.painScoreThreshold} requires a next action (extra anesthetic / pause / follow-up).`,
      );
    }
  }

  const updated = await updateEncounterAudited(
    params.encounterId,
    params.tenantId,
    {
      painScore: params.painScore,
      painNextAction: crosses ? params.nextAction : null,
    },
    { userId: params.userId },
  );

  if (crosses) {
    await createClinicalAlertAudited(
      {
        tenant: { connect: { id: params.tenantId } },
        encounter: { connect: { id: params.encounterId } },
        type: "pain_spike",
        sourceRecordId: params.encounterId,
      },
      { tenantId: params.tenantId, userId: params.userId },
    );
    await createAuditLog({
      tenantId: params.tenantId,
      userId: params.userId,
      action: AuditAction.UPDATE,
      entity: "Encounter",
      entityId: params.encounterId,
      metadata: {
        kind: "pain_spike",
        painScore: params.painScore,
        nextAction: params.nextAction,
        threshold: settings.painScoreThreshold,
      },
    });
  }

  return updated;
}

/**
 * On encounter completion: write back completed TreatmentItems + fulfill origin recall.
 */
export async function writeBackPlanAndRecall(params: {
  tenantId: string;
  encounterId: string;
  staffMemberId?: string | null;
  userId?: string;
}) {
  const encounter = await db.encounter.findFirst({
    where: { id: params.encounterId, tenantId: params.tenantId, deletedAt: null },
    include: {
      procedureLines: {
        where: { status: "completed", treatmentItemId: { not: null } },
      },
    },
  });
  if (!encounter) throw new Error("Encounter not found.");

  const now = new Date();
  const itemIds = treatmentItemIdsForWriteBack(encounter.procedureLines);
  for (const treatmentItemId of itemIds) {
    await db.treatmentItem.updateMany({
      where: {
        id: treatmentItemId,
        tenantId: params.tenantId,
        status: { not: "completed" },
      },
      data: {
        status: "completed",
        completedAt: now,
        completedByStaffId: params.staffMemberId ?? null,
      },
    });
  }

  if (encounter.originRecallId) {
    await db.recall.updateMany({
      where: {
        id: encounter.originRecallId,
        tenantId: params.tenantId,
        status: { not: "COMPLETED" },
      },
      data: {
        status: "COMPLETED",
        completedAt: now,
      },
    });
  }

  await createAuditLog({
    tenantId: params.tenantId,
    userId: params.userId,
    action: AuditAction.UPDATE,
    entity: "Encounter",
    entityId: encounter.id,
    metadata: {
      kind: "plan_recall_writeback",
      treatmentItemIds: itemIds,
      originRecallId: encounter.originRecallId,
    },
  });
}

export function rollupEncounterLineStatuses(
  statuses: string[],
): "empty" | "active" | "all_terminal" {
  if (statuses.length === 0) return "empty";
  if (statuses.every(isProcedureLineTerminal)) return "all_terminal";
  return "active";
}
