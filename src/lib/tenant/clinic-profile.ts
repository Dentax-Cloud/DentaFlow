import type { Settings, Tenant } from "@prisma/client";
import { getCountryByCode, MONTHLY_PATIENT_OPTIONS } from "@/lib/auth/countries";
import { formatDate } from "@/lib/utils";

export type ClinicCustomField = {
  id: string;
  label: string;
  value: string;
};

export type ClinicProfileMetadata = {
  currency?: string;
  specialties?: string[];
  expectedMonthlyPatients?: string;
  referralSource?: string;
  doctorCount?: number;
  addressLine1?: string;
  addressLine2?: string;
  state?: string;
  postalCode?: string;
  taxId?: string;
  taxIdType?: string;
  customFields?: ClinicCustomField[];
};

export type ClinicProfileView = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  countryName: string | null;
  timezone: string;
  locale: string;
  status: Tenant["status"];
  subscriptionPlan: Tenant["subscriptionPlan"];
  subscriptionStatus: Tenant["subscriptionStatus"];
  trialEndsAt: Date | null;
  createdAt: Date;
  chairCount: number;
  currency: string;
  metadata: ClinicProfileMetadata;
  expectedMonthlyPatientsLabel: string | null;
};

function parseMetadata(raw: Tenant["metadata"]): ClinicProfileMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const m = raw as Record<string, unknown>;
  const customFields = Array.isArray(m.customFields)
    ? m.customFields
        .filter(
          (f): f is ClinicCustomField =>
            typeof f === "object" &&
            f !== null &&
            typeof (f as ClinicCustomField).id === "string" &&
            typeof (f as ClinicCustomField).label === "string" &&
            typeof (f as ClinicCustomField).value === "string",
        )
    : [];

  return {
    currency: typeof m.currency === "string" ? m.currency : undefined,
    specialties: Array.isArray(m.specialties)
      ? m.specialties.filter((s): s is string => typeof s === "string")
      : undefined,
    expectedMonthlyPatients:
      typeof m.expectedMonthlyPatients === "string" ? m.expectedMonthlyPatients : undefined,
    referralSource: typeof m.referralSource === "string" ? m.referralSource : undefined,
    doctorCount: typeof m.doctorCount === "number" ? m.doctorCount : undefined,
    addressLine1: typeof m.addressLine1 === "string" ? m.addressLine1 : undefined,
    addressLine2: typeof m.addressLine2 === "string" ? m.addressLine2 : undefined,
    state: typeof m.state === "string" ? m.state : undefined,
    postalCode: typeof m.postalCode === "string" ? m.postalCode : undefined,
    taxId: typeof m.taxId === "string" ? m.taxId : undefined,
    taxIdType: typeof m.taxIdType === "string" ? m.taxIdType : undefined,
    customFields,
  };
}

export function buildClinicProfileView(
  tenant: Tenant,
  settings: Settings | null,
  chairCount: number,
): ClinicProfileView {
  const metadata = parseMetadata(tenant.metadata);
  const countryName = tenant.country ? getCountryByCode(tenant.country)?.name ?? tenant.country : null;
  const expectedMonthlyPatientsLabel =
    MONTHLY_PATIENT_OPTIONS.find((o) => o.value === metadata.expectedMonthlyPatients)?.label ??
    metadata.expectedMonthlyPatients ??
    null;

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    logoUrl: tenant.logoUrl,
    email: tenant.email,
    phone: tenant.phone,
    address: tenant.address,
    city: tenant.city,
    country: tenant.country,
    countryName,
    timezone: tenant.timezone,
    locale: tenant.locale,
    status: tenant.status,
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
    trialEndsAt: tenant.trialEndsAt,
    createdAt: tenant.createdAt,
    chairCount,
    currency: settings?.currency ?? metadata.currency ?? "USD",
    metadata,
    expectedMonthlyPatientsLabel,
  };
}

export function parseMetadataForUpdate(raw: Tenant["metadata"]): ClinicProfileMetadata {
  return parseMetadata(raw);
}

export function mergeTenantMetadata(
  existing: Tenant["metadata"],
  patch: Partial<ClinicProfileMetadata>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}

export function formatProfileRegisteredOn(date: Date): string {
  return formatDate(date);
}
