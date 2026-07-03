import { PolicyRank } from "@prisma/client";
import { db } from "@/lib/db";
import { getCountryProfile, isPreAuthDefaultRequired } from "@/lib/countries";

export type InsuranceCalculation = {
  totalAmount: number;
  insurerAmount: number;
  patientAmount: number;
  coPayPercent: number;
  preAuthRequired: boolean;
  providerName: string;
  networkName: string;
  policyId: string | null;
};

type InsuranceContext = {
  providerCode: string;
  networkType: string | null;
  providerName: string;
  networkName: string;
  policyId: string | null;
  coPayPercentFallback: number | null;
};

async function resolveInsuranceContext(
  tenantId: string,
  patientId: string,
): Promise<InsuranceContext | null> {
  const [primaryPolicy, patient] = await Promise.all([
    db.patientInsurancePolicy.findFirst({
      where: {
        tenantId,
        patientId,
        rank: PolicyRank.PRIMARY,
        isActive: true,
      },
      include: { provider: true },
    }),
    db.patient.findFirst({
      where: { id: patientId, tenantId },
      select: {
        insuranceProvider: true,
        insuranceNetwork: true,
        insuranceCoPayPercent: true,
      },
    }),
  ]);

  if (primaryPolicy) {
    const providerCode =
      primaryPolicy.provider?.code ??
      patient?.insuranceProvider ??
      null;
    if (!providerCode || providerCode === "SELF_PAY") return null;

    return {
      providerCode,
      networkType: primaryPolicy.networkTier ?? patient?.insuranceNetwork ?? null,
      providerName:
        primaryPolicy.provider?.name ??
        primaryPolicy.providerNameFreeText ??
        providerCode,
      networkName: primaryPolicy.networkTier ?? patient?.insuranceNetwork ?? "",
      policyId: primaryPolicy.id,
      coPayPercentFallback: patient?.insuranceCoPayPercent
        ? Number(patient.insuranceCoPayPercent)
        : null,
    };
  }

  if (!patient?.insuranceProvider || patient.insuranceProvider === "SELF_PAY") {
    return null;
  }

  return {
    providerCode: patient.insuranceProvider,
    networkType: patient.insuranceNetwork,
    providerName: patient.insuranceProvider,
    networkName: patient.insuranceNetwork ?? "",
    policyId: null,
    coPayPercentFallback: patient.insuranceCoPayPercent
      ? Number(patient.insuranceCoPayPercent)
      : null,
  };
}

export async function calculateInsuranceSplit(input: {
  tenantId: string;
  patientId: string;
  procedureCodes: string[];
  totalAmount: number;
}): Promise<InsuranceCalculation | null> {
  const context = await resolveInsuranceContext(input.tenantId, input.patientId);
  if (!context) return null;

  const tenant = await db.tenant.findUnique({
    where: { id: input.tenantId },
    select: { countryCode: true },
  });
  const countryCode = tenant?.countryCode ?? "AE";

  let totalInsurerAmount = 0;
  let totalPatientAmount = 0;
  let usedFeeSchedule = false;

  for (const code of input.procedureCodes) {
    if (!code) continue;
    const feeSchedule = await db.insuranceFeeSchedule.findFirst({
      where: {
        tenantId: input.tenantId,
        providerCode: context.providerCode,
        procedureCode: code,
        AND: [
          {
            OR: [
              { networkType: context.networkType },
              { networkType: null },
            ],
          },
          {
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
          },
        ],
      },
      orderBy: { effectiveFrom: "desc" },
    });

    if (feeSchedule) {
      totalInsurerAmount += Number(feeSchedule.insurerFee);
      totalPatientAmount += Number(feeSchedule.patientFee);
      usedFeeSchedule = true;
    }
  }

  if (usedFeeSchedule) {
    return {
      totalAmount: input.totalAmount,
      insurerAmount: totalInsurerAmount,
      patientAmount: totalPatientAmount,
      coPayPercent:
        input.totalAmount > 0 ? (totalPatientAmount / input.totalAmount) * 100 : 0,
      preAuthRequired: isPreAuthDefaultRequired(countryCode),
      providerName: context.providerName,
      networkName: context.networkName,
      policyId: context.policyId,
    };
  }

  const coPayPercent =
    context.coPayPercentFallback ??
    (() => {
      const profile = getCountryProfile(countryCode);
      const provider = profile.insuranceProviders.find(
        (p) => p.code === context.providerCode,
      );
      const network = provider?.networkTypes.find(
        (n) => n.code === context.networkType,
      );
      return network?.defaultCoPayPercent ?? 20;
    })();

  const patientAmount = input.totalAmount * (coPayPercent / 100);
  const insurerAmount = input.totalAmount - patientAmount;

  return {
    totalAmount: input.totalAmount,
    insurerAmount,
    patientAmount,
    coPayPercent,
    preAuthRequired: isPreAuthDefaultRequired(countryCode),
    providerName: context.providerName,
    networkName: context.networkName,
    policyId: context.policyId,
  };
}

export async function patientHasActiveInsurance(
  tenantId: string,
  patientId: string,
): Promise<boolean> {
  const context = await resolveInsuranceContext(tenantId, patientId);
  return context !== null;
}
