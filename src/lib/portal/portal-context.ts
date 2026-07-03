import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getPortalSession } from "./portal-auth";
import { redirect } from "next/navigation";
import { tenantHasPatientPortalEntitlement } from "./portal-plan";

export type PortalContext = {
  accountId: string;
  tenantId: string;
  patientId: string;
  tenantSlug: string;
  email: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientId: string | null;
    phone: string | null;
    email: string | null;
    photoUrl: string | null;
    bloodGroup: string | null;
    allergies: string[];
    dateOfBirth: Date | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
    portalEnabled: boolean;
    bookingEnabled: boolean;
    autoConfirmBooking: boolean;
    bookingLeadHours: number;
    bookingMaxDays: number;
    bookingBufferMins: number;
    portalWelcomeMsg: string | null;
  };
};

export async function requirePortalContext(slug: string): Promise<PortalContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(`portal_token_${slug}`)?.value;

  const session = await getPortalSession(token, slug);

  if (!session) {
    redirect(`/portal/${slug}/login`);
  }

  const [patient, tenant] = await Promise.all([
    db.patient.findFirst({
      where: {
        id: session.patientId,
        tenantId: session.tenantId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        patientId: true,
        phone: true,
        email: true,
        photoUrl: true,
        bloodGroup: true,
        allergies: true,
        dateOfBirth: true,
      },
    }),
    db.tenant.findFirst({
      where: {
        id: session.tenantId,
        slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        email: true,
        logoUrl: true,
        portalEnabled: true,
        bookingEnabled: true,
        autoConfirmBooking: true,
        bookingLeadHours: true,
        bookingMaxDays: true,
        bookingBufferMins: true,
        portalWelcomeMsg: true,
        subscriptionPlan: true,
      },
    }),
  ]);

  if (!patient || !tenant) {
    redirect(`/portal/${slug}/login`);
  }

  if (!tenantHasPatientPortalEntitlement(tenant.subscriptionPlan)) {
    redirect(`/portal/${slug}/disabled?reason=plan`);
  }

  if (!tenant.portalEnabled) {
    redirect(`/portal/${slug}/disabled`);
  }

  return {
    accountId: session.sub,
    tenantId: session.tenantId,
    patientId: session.patientId,
    tenantSlug: slug,
    email: session.email,
    patient,
    tenant,
  };
}

export async function getPortalTenant(slug: string) {
  return db.tenant.findFirst({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      email: true,
      logoUrl: true,
      portalEnabled: true,
      bookingEnabled: true,
      portalWelcomeMsg: true,
      tenantCode: true,
      countryCode: true,
      portalLogoUrl: true,
      subscriptionPlan: true,
    },
  });
}
