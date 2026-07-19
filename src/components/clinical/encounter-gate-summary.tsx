"use client";

import type { GateSummary } from "@/lib/encounter/types";
import { GateStatusChip, type GateChipStatus } from "@/components/clinical/gate-status-chip";

export function EncounterGateSummary({
  gates,
  footer,
  className,
  insuranceOverridden,
}: {
  gates: GateSummary;
  footer?: React.ReactNode;
  className?: string;
  insuranceOverridden?: boolean;
}) {
  const insuranceStatus: GateChipStatus = insuranceOverridden
    ? "overridden"
    : gates.insurance;

  return (
    <section className={className ?? "space-y-3"}>
      <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
        Gate summary
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <GateStatusChip label="Risk" status={gates.risk} />
        <GateStatusChip label="Consent" status={gates.consent} />
        <GateStatusChip label="Insurance" status={insuranceStatus} />
        <GateStatusChip label="Sterilization" status={gates.sterilization} />
      </div>
      {footer}
    </section>
  );
}
