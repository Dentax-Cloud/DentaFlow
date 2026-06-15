import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getPatients } from "@/app/(dashboard)/features/patients/actions";
import { PatientsClient } from "./patients-client";

export default async function PatientsPage() {
  const ctx = await requireRouteAccess("patients", "read");
  const patients = await getPatients(ctx.tenant.id);

  return <PatientsClient initialPatients={patients} />;
}
