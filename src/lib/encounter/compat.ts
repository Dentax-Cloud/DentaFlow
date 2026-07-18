/**
 * Read-only compatibility layer: maps existing chairside/Visit Board data into
 * the Module 6 Encounter + EncounterProcedureLine shape without writing.
 */
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/tenant/context";
import type {
  CompatEncounter,
  CompatProcedureLine,
  EncounterProcedureLineStatus,
  EncounterStatus,
  GateSummary,
  TimelineEvent,
} from "./types";

function mapVisitLineStatus(status: string): EncounterProcedureLineStatus {
  switch (status.toUpperCase()) {
    case "IN_PROGRESS":
      return "in_progress";
    case "CLOSED":
    case "LOCKED":
      return "completed";
    case "VOIDED":
      return "declined";
    default:
      return "planned";
  }
}

function mapSessionToEncounterStatus(params: {
  sessionStatus: string | null;
  finalizedAt: Date | null;
  closedReason: string | null;
}): EncounterStatus {
  if (params.closedReason === "ABANDONED" || params.sessionStatus === "ABANDONED") {
    return "interrupted";
  }
  if (params.finalizedAt || params.sessionStatus === "FINALIZED") {
    return "billing";
  }
  if (params.sessionStatus === "ACTIVE") {
    return "procedure_execution";
  }
  return "arrival_intake";
}

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/**
 * Prefer a real Encounter row when present; otherwise synthesize from chairside
 * + Visit Board procedure lines. Never writes.
 */
export async function getCompatEncounterForAppointment(
  appointmentId: string,
): Promise<CompatEncounter | null> {
  const ctx = await requireTenantContext();
  const tenantId = ctx.tenant.id;

  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, tenantId, deletedAt: null },
    select: {
      id: true,
      patientId: true,
      startTime: true,
      status: true,
    },
  });
  if (!appointment?.patientId) return null;

  const existing = await db.encounter.findFirst({
    where: { tenantId, appointmentId, deletedAt: null },
    include: {
      procedureLines: {
        include: {
          procedureCatalog: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (existing) {
    return {
      id: existing.id,
      tenantId: existing.tenantId,
      patientId: existing.patientId,
      appointmentId: existing.appointmentId,
      treatmentPlanId: existing.treatmentPlanId,
      status: existing.status as EncounterStatus,
      interruptOutcome: existing.interruptOutcome,
      startedAt: existing.startedAt.toISOString(),
      closedAt: toIso(existing.closedAt),
      source: "encounter",
      procedureLines: existing.procedureLines.map(
        (line): CompatProcedureLine => ({
          id: line.id,
          tenantId: line.tenantId,
          encounterId: line.encounterId,
          treatmentItemId: line.treatmentItemId,
          procedureBundleId: line.procedureBundleId,
          procedureCatalogId: line.procedureCatalogId,
          procedureCode: line.procedureCatalog?.code ?? null,
          procedureName: line.procedureCatalog?.name ?? null,
          toothNumbers: line.toothNumbers,
          surfaces: line.surfaces,
          status: line.status as EncounterProcedureLineStatus,
          plannedVsPerformed: line.plannedVsPerformed as CompatProcedureLine["plannedVsPerformed"],
          providerId: line.providerId,
          startedAt: toIso(line.startedAt),
          completedAt: toIso(line.completedAt),
          source: "encounter",
        }),
      ),
    };
  }

  const sessions = await db.chairsideSession.findMany({
    where: { tenantId, appointmentId },
    include: { entries: { orderBy: { createdAt: "asc" } } },
    orderBy: { startedAt: "asc" },
  });

  const visitLines = await db.procedureLine.findMany({
    where: { tenantId, appointmentId },
    orderBy: { createdAt: "asc" },
  });

  const primary = sessions[0] ?? null;
  const encounterId = `compat:${appointmentId}`;
  const status = mapSessionToEncounterStatus({
    sessionStatus: primary?.status ?? null,
    finalizedAt: primary?.finalizedAt ?? null,
    closedReason: primary?.closedReason ?? null,
  });

  const fromEntries: CompatProcedureLine[] = sessions.flatMap((session) =>
    session.entries.map((entry) => ({
      id: `compat-entry:${entry.id}`,
      tenantId,
      encounterId,
      treatmentItemId: null,
      procedureBundleId: null,
      procedureCatalogId: null,
      procedureCode: entry.procedureCode,
      procedureName: entry.procedureName,
      toothNumbers: entry.toothNumber != null ? [String(entry.toothNumber)] : [],
      surfaces: entry.surface ? [entry.surface] : [],
      status: (session.finalizedAt
        ? "completed"
        : entry.lockedAt
          ? "completed"
          : "in_progress") as EncounterProcedureLineStatus,
      plannedVsPerformed: "matched" as const,
      providerId: session.staffId,
      startedAt: toIso(entry.createdAt),
      completedAt: toIso(entry.lockedAt ?? session.finalizedAt),
      source: "chairside_entry" as const,
    })),
  );

  const fromVisitLines: CompatProcedureLine[] = visitLines.map((line) => ({
    id: `compat-visit-line:${line.id}`,
    tenantId,
    encounterId,
    treatmentItemId: line.treatmentItemId,
    procedureBundleId: null,
    procedureCatalogId: null,
    procedureCode: line.procedureCode,
    procedureName: line.procedureName,
    toothNumbers: [],
    surfaces: [],
    status: mapVisitLineStatus(line.status),
    plannedVsPerformed: "matched" as const,
    providerId: line.ownerType === "DOCTOR" ? line.ownerId : null,
    startedAt: toIso(line.createdAt),
    completedAt: toIso(line.closedAt),
    source: "visit_procedure_line" as const,
  }));

  // Prefer chairside entries when present; otherwise surface Visit Board lines.
  const procedureLines: CompatProcedureLine[] =
    fromEntries.length > 0 ? fromEntries : fromVisitLines;

  return {
    id: encounterId,
    tenantId,
    patientId: appointment.patientId,
    appointmentId,
    treatmentPlanId: null,
    status,
    interruptOutcome:
      status === "interrupted"
        ? primary?.closedReason === "NO_BILL"
          ? "abandoned_no_bill"
          : "abandoned_partial_bill"
        : null,
    startedAt: (primary?.startedAt ?? appointment.startTime).toISOString(),
    closedAt: toIso(primary?.finalizedAt ?? null),
    source: "compat",
    procedureLines,
  };
}

export async function buildGateSummaryForEncounter(
  tenantId: string,
  encounterId: string,
  isCompat: boolean,
): Promise<GateSummary> {
  try {
    if (isCompat || encounterId.startsWith("compat:")) {
      return {
        risk: "unknown",
        consent: "unknown",
        insurance: "unknown",
        sterilization: "unknown",
      };
    }

    // Prefer the Phase 2 never-throw live summary when a real encounter row exists.
    const { buildLiveGateSummary } = await import("./gate-enforcement");
    return buildLiveGateSummary(tenantId, encounterId);
  } catch {
    return {
      risk: "unknown",
      consent: "unknown",
      insurance: "unknown",
      sterilization: "unknown",
    };
  }
}

/**
 * Chronological timeline events for the Chairside Timeline UI.
 */
export async function buildTimelineForAppointment(
  appointmentId: string,
): Promise<{
  encounter: CompatEncounter;
  gates: GateSummary;
  events: TimelineEvent[];
} | null> {
  const ctx = await requireTenantContext();
  const tenantId = ctx.tenant.id;
  const encounter = await getCompatEncounterForAppointment(appointmentId);
  if (!encounter) return null;

  const isCompat = encounter.source === "compat";
  const gates = await buildGateSummaryForEncounter(tenantId, encounter.id, isCompat);
  const events: TimelineEvent[] = [];

  events.push({
    id: `${encounter.id}:intake`,
    kind: "intake",
    at: encounter.startedAt,
    title: "Arrival / intake",
    detail: isCompat ? "Projected from chairside session" : undefined,
    status: "arrival_intake",
  });

  events.push({
    id: `${encounter.id}:gates`,
    kind: "gate_summary",
    at: encounter.startedAt,
    title: "Gate summary",
    detail: `Risk ${gates.risk.toUpperCase()} · Consent ${gates.consent.toUpperCase()} · Insurance ${gates.insurance.toUpperCase()} · Sterilization ${gates.sterilization.toUpperCase()}`,
    status: "gates",
  });

  if (!isCompat) {
    const [presences, materials, alerts, images] = await Promise.all([
      db.providerPresence.findMany({
        where: { tenantId, encounterId: encounter.id },
        include: {
          staff: { select: { firstName: true, lastName: true } },
        },
        orderBy: { presentFrom: "asc" },
      }),
      db.materialUsage.findMany({
        where: {
          tenantId,
          procedureLine: { encounterId: encounter.id },
        },
        include: { item: { select: { name: true, sku: true } } },
        orderBy: { deductedAt: "asc" },
      }),
      db.clinicalAlert.findMany({
        where: { tenantId, encounterId: encounter.id },
        orderBy: { createdAt: "asc" },
      }),
      db.clinicalImage.findMany({
        where: {
          tenantId,
          appointmentId,
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
    ]);

    for (const p of presences) {
      events.push({
        id: `presence:${p.id}`,
        kind: "handoff",
        at: p.presentFrom.toISOString(),
        title: `Provider presence — ${p.staff.firstName} ${p.staff.lastName}`.trim(),
        detail: `Stage ${p.stage.toUpperCase()}${p.presentTo ? "" : " (active)"}`,
        status: p.stage,
      });
    }

    for (const m of materials) {
      events.push({
        id: `material:${m.id}`,
        kind: "material",
        at: m.deductedAt.toISOString(),
        title: `Material: ${m.item.name}`,
        detail: `${String(m.quantity)} · ${m.tier.toUpperCase()}${m.lotNumber ? ` · lot ${m.lotNumber}` : ""}`,
        status: m.tier,
      });
    }

    for (const a of alerts) {
      if (a.type === "pain_spike" || a.type.includes("interrupt")) {
        events.push({
          id: `alert:${a.id}`,
          kind: "interrupt",
          at: a.createdAt.toISOString(),
          title: `Alert: ${a.type.replaceAll("_", " ")}`,
          status: a.acknowledgedAt ? "acknowledged" : "open",
        });
      }
    }

    for (const img of images) {
      events.push({
        id: `image:${img.id}`,
        kind: "image",
        at: (img.takenAt ?? img.createdAt).toISOString(),
        title: `Image captured — ${img.type}${img.subtype ? ` / ${img.subtype}` : ""}`,
        detail: img.fileName ?? undefined,
      });
    }
  } else {
    // Compat: surfaces from chairside + clinical images on the appointment
    const images = await db.clinicalImage.findMany({
      where: { tenantId, appointmentId },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    for (const img of images) {
      events.push({
        id: `image:${img.id}`,
        kind: "image",
        at: (img.takenAt ?? img.createdAt).toISOString(),
        title: `Image captured — ${img.type}${img.subtype ? ` / ${img.subtype}` : ""}`,
        detail: img.fileName ?? undefined,
      });
    }

    if (encounter.status === "interrupted") {
      events.push({
        id: `${encounter.id}:interrupt`,
        kind: "interrupt",
        at: encounter.closedAt ?? encounter.startedAt,
        title: "Encounter interrupted",
        detail: encounter.interruptOutcome?.replaceAll("_", " ") ?? undefined,
        status: "interrupted",
      });
    }
  }

  for (const line of encounter.procedureLines) {
    events.push({
      id: `proc:${line.id}`,
      kind: "procedure",
      at: line.startedAt ?? encounter.startedAt,
      title: line.procedureName ?? line.procedureCode ?? "Procedure",
      detail: [
        line.toothNumbers.length ? `Teeth ${line.toothNumbers.join(", ")}` : null,
        line.surfaces.length ? `Surfaces ${line.surfaces.join(", ")}` : null,
        line.source !== "encounter" ? `Source: ${line.source}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      status: line.status,
    });
  }

  events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

  return { encounter, gates, events };
}
