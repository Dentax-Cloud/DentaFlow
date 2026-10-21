import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getPatients } from "@/app/(dashboard)/features/patients/actions";
import { getPrimaryInsuranceStatusMap } from "@/app/(dashboard)/features/insurance/insurance-policy-actions";
import { buildPatientFormFields } from "@/lib/countries/patient-form-config";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { serializeMany } from "@/lib/utils/serialize";
import { requireStaffMemberRole } from "@/lib/rbac/staff-role";
import { PatientsClient } from "./patients-client";

export default async function PatientsPage() {
  const ctx = await requireRouteAccess("patients", "read");
  const role = requireStaffMemberRole(ctx);
  const canWrite = hasPermission(role, PERMISSIONS.patients.write);

  const [patients, formFields, insuranceStatusMap] = await Promise.all([
    getPatients(),
    buildPatientFormFields(ctx.tenant.id, ctx.tenant.countryCode ?? "AE", {
      secondaryLanguage: ctx.tenant.secondaryLanguage,
    }),
    getPrimaryInsuranceStatusMap(),
  ]);

  return (
    <PatientsClient
      initialPatients={serializeMany(patients)}
      formFields={formFields}
      countryCode={ctx.tenant.countryCode ?? "AE"}
      canWrite={canWrite}
      insuranceStatusMap={insuranceStatusMap}
    />
  );
}
