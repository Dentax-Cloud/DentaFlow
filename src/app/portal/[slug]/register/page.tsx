export const runtime = "nodejs";

import { getPortalTenant } from "@/lib/portal/portal-context";
import { tenantHasPatientPortalEntitlement } from "@/lib/portal/portal-plan";
import { notFound, redirect } from "next/navigation";
import { buildPatientFormFields } from "@/lib/countries/patient-form-config";
import PortalRegisterClient from "./register-client";

export default async function PortalRegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getPortalTenant(slug);
  if (!tenant || !tenant.portalEnabled) notFound();
  if (!tenantHasPatientPortalEntitlement(tenant.subscriptionPlan)) {
    redirect(`/portal/${slug}/disabled?reason=plan`);
  }

  const formFields = await buildPatientFormFields(
    tenant.id,
    tenant.countryCode ?? "AE",
    { portalOnly: true, secondaryLanguage: tenant.secondaryLanguage },
  );

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tenant.name} Patient Portal</p>
      </div>
      <PortalRegisterClient
        slug={slug}
        formFields={formFields}
        countryCode={tenant.countryCode ?? "AE"}
      />
    </div>
  );
}
