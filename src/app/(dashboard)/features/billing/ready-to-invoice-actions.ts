"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { serializeDecimal } from "@/lib/utils/serialize";
import { lookupByBarcode } from "@/app/(dashboard)/features/patients/barcode-actions";
import { generateInvoiceFromProcedureLines } from "@/lib/billing/generate-invoice-from-procedure-lines";
import {
  aggregateProcedureLineTotal,
  classifyAppointmentForBillingQueue,
  countDistinctVisitInvoices,
  getAgingBucket,
  type AgingBucket,
  type BillingQueueSection,
} from "@/lib/billing/procedure-line-invoice";

export type BillingQueueLineRow = {
  id: string;
  ownerType: string;
  ownerName: string | null;
  procedureName: string | null;
  procedureCode: string | null;
  unitPrice: number;
  quantity: number;
  status: string;
  lockedAt: string | null;
  requiresPreAuth: boolean;
  preAuthStatus: string | null;
};

export type BillingQueueEntry = {
  appointmentId: string;
  appointmentRef: string | null;
  patientId: string;
  patientName: string;
  patientBarcode: string | null;
  appointmentDate: string;
  appointmentStatus: string;
  completedAt: string | null;
  agingBucket: AgingBucket | null;
  section: BillingQueueSection;
  lines: BillingQueueLineRow[];
  unbilledClosedLines: BillingQueueLineRow[];
  estimatedTotal: number;
  existingVisitInvoiceCount: number;
};

export type BillingQueueResult = {
  ready: Record<AgingBucket, BillingQueueEntry[]>;
  interim: BillingQueueEntry[];
};

function serializeLine(
  line: {
    id: string;
    ownerType: string;
    ownerId: string | null;
    status: string;
    procedureCode: string | null;
    procedureName: string | null;
    quantity: number;
    unitPrice: unknown;
    lockedAt: Date | null;
    requiresPreAuth: boolean;
    preAuthStatus: string | null;
  },
  ownerNameById: Map<string, string>,
): BillingQueueLineRow {
  const serialized = serializeDecimal({ unitPrice: line.unitPrice });
  return {
    id: line.id,
    ownerType: line.ownerType,
    ownerName: line.ownerId ? (ownerNameById.get(line.ownerId) ?? null) : null,
    procedureName: line.procedureName,
    procedureCode: line.procedureCode,
    unitPrice: Number(serialized.unitPrice ?? 0),
    quantity: line.quantity,
    status: line.status,
    lockedAt: line.lockedAt?.toISOString() ?? null,
    requiresPreAuth: line.requiresPreAuth,
    preAuthStatus: line.preAuthStatus,
  };
}

export async function getBillingQueue(): Promise<BillingQueueResult> {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.billing.read);

  const queueAppointments = await db.appointment.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      isBlock: false,
      patientId: { not: null },
      status: { notIn: ["CANCELED", "NO_SHOW"] },
      procedureLines: { some: {} },
    },
    orderBy: { startTime: "desc" },
    take: 50,
    select: { id: true },
  });
  const appointmentIds = queueAppointments.map((appointment) => appointment.id);
  if (appointmentIds.length === 0) {
    return {
      ready: { "0-24h": [], "1-3d": [], "3d+": [] },
      interim: [],
    };
  }

  const lines = await db.procedureLine.findMany({
    where: {
      tenantId: ctx.tenantId,
      appointmentId: { in: appointmentIds },
    },
    include: {
      appointment: {
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              patientId: true,
            },
          },
        },
      },
    },
    orderBy: [{ appointmentId: "asc" }, { createdAt: "asc" }],
  });

  const ownerIds = [
    ...new Set(lines.map((line) => line.ownerId).filter((id): id is string => Boolean(id))),
  ];
  const owners =
    ownerIds.length > 0
      ? await db.staffMember.findMany({
          where: { tenantId: ctx.tenantId, id: { in: ownerIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
  const ownerNameById = new Map(
    owners.map((owner) => [
      owner.id,
      `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() || "Staff",
    ]),
  );

  const grouped = new Map<
    string,
    {
      appointment: (typeof lines)[number]["appointment"];
      lines: BillingQueueLineRow[];
    }
  >();

  for (const line of lines) {
    const apt = line.appointment;
    if (!apt?.patient) continue;

    const bucket = grouped.get(apt.id) ?? { appointment: apt, lines: [] };
    bucket.lines.push(serializeLine(line, ownerNameById));
    grouped.set(apt.id, bucket);
  }

  const ready: Record<AgingBucket, BillingQueueEntry[]> = {
    "0-24h": [],
    "1-3d": [],
    "3d+": [],
  };
  const interim: BillingQueueEntry[] = [];
  const now = new Date();

  for (const { appointment, lines: aptLines } of grouped.values()) {
    const patient = appointment.patient!;
    const classification = classifyAppointmentForBillingQueue(appointment.status, aptLines);
    if (!classification.section) continue;

    const unbilledClosed = aptLines.filter(
      (line) => line.status === "CLOSED" && !line.lockedAt,
    );
    const rawForApt = lines.filter((l) => l.appointmentId === appointment.id);
    const visitInvoiceCount = countDistinctVisitInvoices(
      rawForApt.map((l) => l.lockedInvoiceId),
    );

    const entry: BillingQueueEntry = {
      appointmentId: appointment.id,
      appointmentRef: appointment.appointmentRef,
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
      patientBarcode: patient.patientId,
      appointmentDate: appointment.startTime.toISOString(),
      appointmentStatus: appointment.status,
      completedAt:
        appointment.status === "COMPLETED" ? appointment.updatedAt.toISOString() : null,
      agingBucket:
        appointment.status === "COMPLETED"
          ? getAgingBucket(appointment.updatedAt, now)
          : null,
      section: classification.section,
      lines: aptLines,
      unbilledClosedLines: unbilledClosed,
      estimatedTotal: aggregateProcedureLineTotal(
        unbilledClosed.map((line) => ({
          ...line,
          ownerId: null,
          lockedInvoiceId: null,
        })),
      ),
      existingVisitInvoiceCount: visitInvoiceCount,
    };

    if (classification.section === "ready" && entry.agingBucket) {
      ready[entry.agingBucket].push(entry);
    } else if (classification.section === "interim") {
      interim.push(entry);
    }
  }

  const sortByDate = (a: BillingQueueEntry, b: BillingQueueEntry) =>
    new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime();

  ready["0-24h"].sort(sortByDate);
  ready["1-3d"].sort(sortByDate);
  ready["3d+"].sort(sortByDate);
  interim.sort(sortByDate);

  return { ready, interim };
}

export async function lookupPatientForBillingQueue(scannedCode: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.billing.read);
  const result = await lookupByBarcode(scannedCode);
  if (!result) return null;
  return {
    patientId: result.id,
    patientName: `${result.firstName} ${result.lastName}`.trim(),
    barcode: result.patientId,
    tenantId: ctx.tenantId,
  };
}

export { generateInvoiceFromProcedureLines };
