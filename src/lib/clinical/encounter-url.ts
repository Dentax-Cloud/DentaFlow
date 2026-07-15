export type EncounterTab =
  | "chart"
  | "perio"
  | "radiographs"
  | "photos"
  | "treatment-plan"
  | "emergency";

export function encounterWorkspacePath(
  appointmentId: string,
  tab?: EncounterTab,
  extra?: { sessionId?: string },
): string {
  const params = new URLSearchParams();
  if (tab && tab !== "chart") params.set("tab", tab);
  if (extra?.sessionId) params.set("sessionId", extra.sessionId);
  const qs = params.toString();
  return `/clinical/encounter/${appointmentId}${qs ? `?${qs}` : ""}`;
}

/** Module 6 encounter spine workspace (flag-gated). */
export function encounterSpinePath(appointmentId: string): string {
  return `/clinical/encounter/${appointmentId}/spine`;
}

/** Legacy chairside links → encounter workspace when appointment is known. */
export function resolveClinicalSessionPath(params: {
  patientId: string;
  appointmentId?: string | null;
  sessionId?: string | null;
}): string {
  if (params.appointmentId) {
    return encounterWorkspacePath(params.appointmentId, "chart", {
      sessionId: params.sessionId ?? undefined,
    });
  }
  const search = new URLSearchParams({ patientId: params.patientId });
  if (params.sessionId) search.set("sessionId", params.sessionId);
  return `/clinical/chairside?${search.toString()}`;
}
