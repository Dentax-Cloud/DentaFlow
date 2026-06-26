export const runtime = "nodejs";

import { requirePortalContext } from "@/lib/portal/portal-context";
import PortalProfileClient from "./profile-client";

export default async function PortalProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requirePortalContext(slug);

  return (
    <PortalProfileClient
      slug={slug}
      patient={{
        firstName: ctx.patient.firstName,
        lastName: ctx.patient.lastName,
        patientId: ctx.patient.patientId,
        email: ctx.patient.email,
        phone: ctx.patient.phone,
        bloodGroup: ctx.patient.bloodGroup,
        allergies: ctx.patient.allergies,
        dateOfBirth: ctx.patient.dateOfBirth?.toISOString() ?? null,
      }}
    />
  );
}
