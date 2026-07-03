export const runtime = "nodejs";

import { PATIENT_PORTAL_PLAN_MESSAGE } from "@/lib/portal/portal-plan";

export default async function PortalDisabledPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reason?: string }>;
}) {
  const { slug } = await params;
  const { reason } = await searchParams;
  const planBlocked = reason === "plan";

  return (
    <div className="py-16 text-center">
      <p className="mb-4 text-4xl">🔒</p>
      <h1 className="text-xl font-bold">Portal unavailable</h1>
      <p className="mt-2 text-muted-foreground">
        {planBlocked
          ? PATIENT_PORTAL_PLAN_MESSAGE
          : "The patient portal is currently disabled. Please contact your clinic."}
      </p>
      <a href={`/portal/${slug}`} className="mt-4 inline-block text-blue-600 hover:underline">
        Back
      </a>
    </div>
  );
}
