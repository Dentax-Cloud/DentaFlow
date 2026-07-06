import type { ClaimSubmissionMethod, TenantInsuranceProvider } from "@prisma/client";
import { getCountryProfile } from "@/lib/countries";
import type { PlatformInsuranceProvider } from "@/lib/countries/types";
import { db } from "@/lib/db";
import type { ResolvedPayerConfig } from "./submission-types";

function mergePayerConfig(
  platform: PlatformInsuranceProvider | undefined,
  tenant: TenantInsuranceProvider | null | undefined,
  fallbackName?: string | null,
): ResolvedPayerConfig {
  const providerCode = tenant?.code ?? platform?.code ?? "UNKNOWN";
  const providerName =
    tenant?.name ?? platform?.name ?? fallbackName?.trim() ?? providerCode;

  const claimEmail = tenant?.claimEmail ?? platform?.claimEmail ?? null;
  const platformMethod = platform?.claimSubmissionMethod;
  const defaultMethod: ClaimSubmissionMethod =
    platformMethod ??
    (claimEmail ? "EMAIL" : "MANUAL");

  return {
    providerCode,
    providerName,
    claimEmail,
    claimSubmissionMethod:
      tenant?.claimSubmissionMethod ?? defaultMethod,
    claimsPortalUrl: tenant?.claimsPortalUrl ?? platform?.claimsPortalUrl ?? null,
    turnaroundDays: tenant?.turnaroundDays ?? platform?.turnaroundDays ?? null,
    contactPhone: tenant?.contactPhone ?? null,
  };
}

export async function resolvePayerConfigForPolicy(
  tenantId: string,
  countryCode: string,
  policy: {
    providerId: string | null;
    providerNameFreeText: string | null;
    provider?: TenantInsuranceProvider | null;
  },
): Promise<ResolvedPayerConfig> {
  const profile = getCountryProfile(countryCode);
  let tenantProvider = policy.provider ?? null;

  if (!tenantProvider && policy.providerId) {
    tenantProvider = await db.tenantInsuranceProvider.findFirst({
      where: { id: policy.providerId, tenantId },
    });
  }

  if (!tenantProvider && policy.providerNameFreeText) {
    const freeText = policy.providerNameFreeText.trim();
    tenantProvider = await db.tenantInsuranceProvider.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [{ name: freeText }, { code: freeText }],
      },
    });
  }

  const platformProvider = tenantProvider
    ? profile.insuranceProviders.find((p) => p.code === tenantProvider!.code)
    : profile.insuranceProviders.find(
        (p) =>
          p.name === policy.providerNameFreeText?.trim() ||
          p.code === policy.providerNameFreeText?.trim(),
      );

  if (!tenantProvider && platformProvider) {
    const tenantOverride = await db.tenantInsuranceProvider.findFirst({
      where: {
        tenantId,
        code: platformProvider.code,
        isActive: true,
      },
    });
    if (tenantOverride) {
      tenantProvider = tenantOverride;
    }
  }

  return mergePayerConfig(
    platformProvider,
    tenantProvider,
    policy.providerNameFreeText,
  );
}
