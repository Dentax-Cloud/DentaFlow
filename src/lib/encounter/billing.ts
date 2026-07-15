import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  createInvoiceFromItems,
  type InvoiceLineItem,
} from "@/lib/billing/invoice-from-items";
import { completeVisit } from "@/lib/clinical/complete-visit";
import { updateEncounterAudited } from "./repository";
import { writeBackPlanAndRecall } from "./procedure-execution";
import { isProcedureLineBillable } from "./state-machine";
import { transitionEncounterStatus } from "./lifecycle";

export class EncounterDoubleInvoiceError extends Error {
  constructor(message = "This encounter already has an invoice.") {
    super(message);
    this.name = "EncounterDoubleInvoiceError";
  }
}

export class EncounterBillingGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncounterBillingGateError";
  }
}

export async function assertEncounterCanInvoice(
  tenantId: string,
  encounterId: string,
): Promise<void> {
  const existing = await db.invoice.findFirst({
    where: { tenantId, encounterId, deletedAt: null },
    select: { id: true, invoiceNumber: true },
  });
  if (existing) {
    throw new EncounterDoubleInvoiceError(
      `Encounter already invoiced as ${existing.invoiceNumber}.`,
    );
  }
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

/** Pure selection rules for which spine lines enter an invoice. */
export function isSpineLineIncludedInInvoice(
  line: { status: string; billedInvoiceId?: string | null },
  opts?: { partialBill?: boolean },
): boolean {
  if (line.billedInvoiceId) return false;
  if (line.status === "declined") return false;
  if (line.status === "in_progress" || line.status === "planned") return false;
  if (!isProcedureLineBillable(line.status)) return false;
  if (line.status === "interrupted" && !opts?.partialBill) return false;
  return true;
}

export function assertNoInProgressLines(statuses: string[]): void {
  if (statuses.some((s) => s === "in_progress")) {
    throw new EncounterBillingGateError(
      "Cannot generate invoice while any procedure line is still in progress.",
    );
  }
}

export async function buildInvoiceItemsFromEncounter(
  tenantId: string,
  encounterId: string,
  opts?: { partialBill?: boolean },
): Promise<InvoiceLineItem[]> {
  const encounter = await db.encounter.findFirst({
    where: { id: encounterId, tenantId, deletedAt: null },
    include: {
      procedureLines: {
        include: {
          procedureCatalog: true,
          materialUsages: {
            include: { item: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  if (!encounter) throw new Error("Encounter not found.");

  assertNoInProgressLines(encounter.procedureLines.map((l) => l.status));

  const items: InvoiceLineItem[] = [];
  const partial =
    Boolean(opts?.partialBill) ||
    encounter.interruptOutcome === "abandoned_partial_bill";

  for (const line of encounter.procedureLines) {
    if (!isSpineLineIncludedInInvoice(line, { partialBill: partial })) continue;

    if (line.treatmentItemId) {
      const lockedVisitLine = await db.procedureLine.findFirst({
        where: {
          tenantId,
          treatmentItemId: line.treatmentItemId,
          lockedInvoiceId: { not: null },
          status: "LOCKED",
        },
        select: { id: true },
      });
      if (lockedVisitLine) continue;
    }

    const unitPrice = decimalToNumber(line.unitPrice ?? line.procedureCatalog.price);
    items.push({
      description: line.procedureCatalog.name,
      quantity: 1,
      unitPrice,
      total: unitPrice,
      procedureCode: line.procedureCatalog.code,
      itemType: "SERVICE",
    });

    for (const usage of line.materialUsages) {
      const qty = decimalToNumber(usage.quantity);
      const cost = decimalToNumber(usage.unitCost);
      const lineTotal = Math.round(qty * cost * 100) / 100;
      if (lineTotal <= 0) continue;
      items.push({
        description: `Material · ${usage.item.name}`,
        quantity: qty,
        unitPrice: cost,
        total: lineTotal,
        inventoryItemId: usage.itemId,
        itemType: "GOOD",
      });
    }
  }

  return items;
}

export type CloseAndInvoiceEncounterParams = {
  tenantId: string;
  encounterId: string;
  userId?: string;
  staffMemberId?: string | null;
  closedReason?: string;
  partialBill?: boolean;
};

/**
 * Coherent session-close + invoice generation for spine encounters.
 * Unique Invoice.encounterId is the concurrency-safe double-invoice guard.
 */
export async function closeAndInvoiceEncounter(params: CloseAndInvoiceEncounterParams) {
  await db.$executeRaw`
    SELECT id FROM "Encounter"
    WHERE id = ${params.encounterId}
      AND "tenantId" = ${params.tenantId}
      AND "deletedAt" IS NULL
    FOR UPDATE
  `.catch(() => null);

  await assertEncounterCanInvoice(params.tenantId, params.encounterId);

  const encounter = await db.encounter.findFirst({
    where: {
      id: params.encounterId,
      tenantId: params.tenantId,
      deletedAt: null,
    },
    include: { procedureLines: true },
  });
  if (!encounter) throw new Error("Encounter not found.");

  if (encounter.procedureLines.some((l) => l.status === "in_progress")) {
    throw new EncounterBillingGateError(
      "Cannot generate invoice while any procedure line is still in progress.",
    );
  }

  const partial =
    params.partialBill || encounter.interruptOutcome === "abandoned_partial_bill";

  const items = await buildInvoiceItemsFromEncounter(params.tenantId, params.encounterId, {
    partialBill: Boolean(partial),
  });
  if (items.length === 0) {
    throw new EncounterBillingGateError(
      "No billable procedure or material lines to invoice.",
    );
  }

  let invoice;
  try {
    invoice = await createInvoiceFromItems({
      tenantId: params.tenantId,
      patientId: encounter.patientId,
      encounterId: params.encounterId,
      items,
      notes: `Spine encounter ${params.encounterId}`,
      status: "DRAFT",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|UniqueConstraint|encounterId/i.test(msg)) {
      throw new EncounterDoubleInvoiceError();
    }
    throw e;
  }

  await db.encounterProcedureLine.updateMany({
    where: {
      tenantId: params.tenantId,
      encounterId: params.encounterId,
      status: { in: ["completed", "interrupted"] },
      billedInvoiceId: null,
    },
    data: { billedInvoiceId: invoice.id },
  });

  const closedReason = params.closedReason ?? "manual_close_bill";
  await updateEncounterAudited(
    params.encounterId,
    params.tenantId,
    {
      status: "recall_scheduled",
      closedAt: new Date(),
      closedReason,
    },
    { userId: params.userId },
  );

  await writeBackPlanAndRecall({
    tenantId: params.tenantId,
    encounterId: params.encounterId,
    staffMemberId: params.staffMemberId,
    userId: params.userId,
  });

  await completeVisit({
    appointmentId: encounter.appointmentId,
    tenantId: params.tenantId,
    skipChairsideAutoClose: true,
  }).catch(() => null);

  return invoice;
}

export async function advanceToProcedureExecutionIfReady(params: {
  tenantId: string;
  encounterId: string;
  userId?: string;
  staffMemberId?: string | null;
}) {
  const { evaluateEncounterGates } = await import("./gates");
  const { loadGateBundleForEncounter } = await import("./gate-enforcement");
  const loaded = await loadGateBundleForEncounter(params.tenantId, params.encounterId);
  if (!loaded) throw new Error("Encounter not found.");
  if (loaded.encounter.status !== "gates") {
    throw new Error("Encounter must be in gates status.");
  }
  const result = evaluateEncounterGates({
    risk: loaded.encounter.riskAssessments[0] ?? null,
    consent: loaded.encounter.consentRecords[0] ?? null,
    insurance: loaded.encounter.insuranceVerifications[0] ?? null,
    sterilizationLogs: [],
    preAuthOverridden: loaded.encounter.preAuthOverridden,
  });
  if (!(result.risk.cleared && result.consent?.cleared && result.insurance?.cleared)) {
    throw new Error(
      "Risk, consent, and insurance gates must all be clear before procedures.",
    );
  }
  return transitionEncounterStatus({
    tenantId: params.tenantId,
    encounterId: params.encounterId,
    toStatus: "procedure_execution",
    userId: params.userId,
    staffMemberId: params.staffMemberId,
  });
}
