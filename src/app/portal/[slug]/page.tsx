export const runtime = "nodejs";

import { getPortalTenant } from "@/lib/portal/portal-context";
import { tenantHasPatientPortalEntitlement, PATIENT_PORTAL_PLAN_MESSAGE } from "@/lib/portal/portal-plan";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function PortalLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getPortalTenant(slug);

  if (!tenant) notFound();

  if (!tenant.portalEnabled) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-4xl">🔒</p>
        <h1 className="text-xl font-bold">Portal not available</h1>
        <p className="mt-2 text-muted-foreground">
          The patient portal for {tenant.name} is not yet active. Please contact the clinic
          directly.
        </p>
        {tenant.phone && <p className="mt-4 text-blue-600">📞 {tenant.phone}</p>}
      </div>
    );
  }

  if (!tenantHasPatientPortalEntitlement(tenant.subscriptionPlan)) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-4xl">🔒</p>
        <h1 className="text-xl font-bold">Portal not available</h1>
        <p className="mt-2 text-muted-foreground">{PATIENT_PORTAL_PLAN_MESSAGE}</p>
        {tenant.phone && <p className="mt-4 text-blue-600">📞 {tenant.phone}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6 py-12 text-center">
      <div>
        <h1 className="text-3xl font-bold">Welcome to {tenant.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {tenant.portalWelcomeMsg ??
            "Access your appointments, records and invoices online"}
        </p>
      </div>

      <div className="mx-auto grid max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href={`/portal/${slug}/login`}
          className="block rounded-xl bg-blue-600 p-6 text-white transition-colors hover:bg-blue-700"
        >
          <p className="mb-2 text-2xl">🔑</p>
          <p className="font-semibold">Sign in</p>
          <p className="mt-1 text-sm text-blue-100">Existing patients</p>
        </Link>

        <Link
          href={`/portal/${slug}/register`}
          className="block rounded-xl border-2 border-blue-600 bg-white p-6 text-blue-600 transition-colors hover:bg-blue-50"
        >
          <p className="mb-2 text-2xl">✨</p>
          <p className="font-semibold">Register</p>
          <p className="mt-1 text-sm text-blue-500">First time here</p>
        </Link>
      </div>

      <div className="mx-auto mt-8 grid max-w-lg grid-cols-3 gap-4">
        {[
          { icon: "📅", label: "Book appointments" },
          { icon: "🧾", label: "View invoices" },
          { icon: "📋", label: "Sign consent forms" },
        ].map((f) => (
          <div key={f.label} className="p-3 text-center">
            <p className="text-2xl">{f.icon}</p>
            <p className="mt-1 text-xs text-muted-foreground">{f.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
