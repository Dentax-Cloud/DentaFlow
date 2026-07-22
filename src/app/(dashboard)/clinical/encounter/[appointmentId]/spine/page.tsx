export const runtime = "nodejs";

import { notFound, redirect } from "next/navigation";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";
import { encounterWorkspacePath } from "@/lib/clinical/encounter-url";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { loadSpineWorkspaceData } from "@/app/(dashboard)/features/clinical/encounter-spine-actions";
import { SpineWorkspaceClient } from "./spine-workspace-client";

export default async function EncounterSpinePage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  const ctx = await requireRouteAccess("clinical_chart", "read");

  if (!isEncounterSpineEnabled(ctx.tenant)) {
    redirect(encounterWorkspacePath(appointmentId, "chart"));
  }

  const role = ctx.staffMember?.role;
  const canWrite = Boolean(role && hasPermission(role, PERMISSIONS.clinical_chart.write));
  const canWriteInsurance = Boolean(
    role && hasPermission(role, PERMISSIONS.insurance.write),
  );

  let initial;
  try {
    initial = await loadSpineWorkspaceData(appointmentId);
  } catch {
    notFound();
  }

  return (
    <SpineWorkspaceClient
      appointmentId={appointmentId}
      canWrite={canWrite}
      canWriteInsurance={canWriteInsurance}
      initial={initial}
    />
  );
}
