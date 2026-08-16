export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";
import { loadChairPrep } from "@/app/(dashboard)/features/clinical/chair-prep-actions";
import { ChairPrepClient } from "./chair-prep-client";

function serverYmd(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export default async function ChairPrepPage() {
  const ctx = await requireRouteAccess("clinical_chart", "read");
  if (!isEncounterSpineEnabled(ctx.tenant)) redirect("/clinical");
  const clinicDate = serverYmd(ctx.tenant.timezone);
  const chairs = await loadChairPrep(clinicDate);
  return <ChairPrepClient clinicDate={clinicDate} initialChairs={chairs} />;
}
