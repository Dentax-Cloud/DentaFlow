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
  preAuthReference: string | null;
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

  const preAuthOverride = context.policyId
    ? await resolveApprovedPreAuthAmounts(context.policyId, input.totalAmount)
    : null;

  if (preAuthOverride) {
    return {
      totalAmount: input.totalAmount,
      insurerAmount: preAuthOverride.insurerAmount,
      patientAmount: preAuthOverride.patientAmount,
      coPayPercent:
        input.totalAmount > 0
          ? (preAuthOverride.patientAmount / input.totalAmount) * 100
          : 0,
      preAuthRequired: isPreAuthDefaultRequired(countryCode),
      providerName: context.providerName,
      networkName: context.networkName,
      policyId: context.policyId,
      preAuthReference: preAuthOverride.referenceNumber,
    };
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
      preAuthReference: null,
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
    preAuthReference: null,
  };
}

async function resolveApprovedPreAuthAmounts(
  policyId: string,
  invoiceTotal: number,
): Promise<{
  insurerAmount: number;
  patientAmount: number;
  referenceNumber: string | null;
} | null> {
  const preAuth = await db.preAuthorization.findFirst({
    where: {
      policyId,
      status: { in: ["APPROVED", "PARTIALLY_APPROVED"] },
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      approvedInsurerAmount: { not: null },
      approvedPatientAmount: { not: null },
    },
    orderBy: { decisionAt: "desc" },
  });

  if (!preAuth) return null;

  const insurer = Number(preAuth.approvedInsurerAmount ?? 0);
  const patient = Number(preAuth.approvedPatientAmount ?? 0);
  const approvedTotal = insurer + patient;
  if (approvedTotal <= 0) return null;

  if (Math.abs(approvedTotal - invoiceTotal) < 0.02) {
    return {
      insurerAmount: insurer,
      patientAmount: patient,
      referenceNumber: preAuth.referenceNumber,
    };
  }

  const ratio = invoiceTotal / approvedTotal;
  return {
    insurerAmount: Math.round(insurer * ratio * 100) / 100,
    patientAmount: Math.round(patient * ratio * 100) / 100,
    referenceNumber: preAuth.referenceNumber,
  };
}

export async function patientHasActiveInsurance(
  tenantId: string,
  patientId: string,
): Promise<boolean> {
  const context = await resolveInsuranceContext(tenantId, patientId);
  return context !== null;
}
