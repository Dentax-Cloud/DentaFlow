import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getPatients } from "@/app/(dashboard)/features/patients/actions";
import { buildPatientFormFields } from "@/lib/countries/patient-form-config";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { serializeMany } from "@/lib/utils/serialize";
import { UserRole } from "@prisma/client";
import { PatientsClient } from "./patients-client";

export default async function PatientsPage() {
  const ctx = await requireRouteAccess("patients", "read");
  const role = ctx.staffMember?.role ?? UserRole.OWNER;
  const canWrite = hasPermission(role, PERMISSIONS.patients.write);

  const [patients, formFields] = await Promise.all([
    getPatients(ctx.tenant.id),
    buildPatientFormFields(ctx.tenant.id, ctx.tenant.countryCode ?? "AE"),
  ]);

  return (
    <PatientsClient
      initialPatients={serializeMany(patients)}
      formFields={formFields}
      countryCode={ctx.tenant.countryCode ?? "AE"}
      canWrite={canWrite}
    />
  );
}
