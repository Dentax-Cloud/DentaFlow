import { db } from "@/lib/db";
import { buildPatientWelcomeEmail } from "@/lib/email/templates/patient-welcome";
import { sendMail } from "@/lib/mail";

function appBaseUrl() {
  return (
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

export async function sendPatientWelcomeEmail(
  tenantId: string,
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    patientId: string | null;
    patientNumber: string;
  },
): Promise<void> {
  if (!patient.email?.trim()) return;

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      phone: true,
      slug: true,
      logoUrl: true,
      portalEnabled: true,
      countryCode: true,
    },
  });

  if (!tenant) return;

  const portalUrl = `${appBaseUrl()}/portal/${tenant.slug}`;
  const emailContent = await buildPatientWelcomeEmail({
    patientName: `${patient.firstName} ${patient.lastName}`,
    patientId: patient.patientId ?? patient.patientNumber,
    clinicName: tenant.name,
    clinicPhone: tenant.phone ?? undefined,
    clinicLogoUrl: tenant.logoUrl ?? undefined,
    portalEnabled: tenant.portalEnabled,
    portalUrl,
    tenantSlug: tenant.slug,
    countryCode: tenant.countryCode ?? "AE",
  });

  await sendMail({
    to: patient.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  }).catch(() => null);
}
