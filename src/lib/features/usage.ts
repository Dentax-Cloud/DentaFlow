import { db } from "@/lib/db";
import { getUsageSummary } from "@/lib/features/gate";

function usagePct(used: number, max: number): number {
  if (max === Infinity || max <= 0) return 0;
  return Math.round((used / max) * 100);
}

export async function getTenantUsage(tenantId: string) {
  const summary = await getUsageSummary(tenantId);

  return {
    patients: {
      used: summary.patients.current,
      max: summary.patients.unlimited ? -1 : summary.patients.limit,
      pct: usagePct(summary.patients.current, summary.patients.limit),
    },
    staff: {
      used: summary.staff.current,
      max: summary.staff.unlimited ? -1 : summary.staff.limit,
      pct: usagePct(summary.staff.current, summary.staff.limit),
    },
    branches: {
      used: summary.branches.current,
      max: summary.branches.unlimited ? -1 : summary.branches.limit,
      pct: usagePct(summary.branches.current, summary.branches.limit),
    },
  };
}
