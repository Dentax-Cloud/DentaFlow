import { db } from "@/lib/db";
import { getCountryProfile } from "@/lib/countries";

export type InsuranceCalculation = {
  totalAmount: number;
  insurerAmount: number;
  patientAmount: number;
  coPayPercent: number;
  preAuthRequired: boolean;
  providerName: string;
  networkName: string;
};

export async function calculateInsuranceSplit(input: {
  tenantId: string;
  patientId: string;
  procedureCodes: string[];
  totalAmount: number;
}): Promise<InsuranceCalculation | null> {
  const patient = await db.patient.findFirst({
    where: { id: input.patientId, tenantId: input.tenantId },
    select: {
      insuranceProvider: true,
      insuranceNetwork: true,
      insuranceCoPayPercent: true,
    },
  });

  if (!patient?.insuranceProvider || patient.insuranceProvider === "SELF_PAY") {
    return null;
  }

  const tenant = await db.tenant.findUnique({
    where: { id: input.tenantId },
    select: { countryCode: true },
  });

  let totalInsurerAmount = 0;
  let totalPatientAmount = 0;
  let usedFeeSchedule = false;

  for (const code of input.procedureCodes) {
    const feeSchedule = await db.insuranceFeeSchedule.findFirst({
      where: {
        tenantId: input.tenantId,
        providerCode: patient.insuranceProvider,
        procedureCode: code,
        AND: [
          {
            OR: [{ networkType: patient.insuranceNetwork }, { networkType: null }],
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
      preAuthRequired: true,
      providerName: patient.insuranceProvider,
      networkName: patient.insuranceNetwork ?? "",
    };
  }

  const coPayPercent = patient.insuranceCoPayPercent
    ? Number(patient.insuranceCoPayPercent)
    : (() => {
        const profile = getCountryProfile(tenant?.countryCode ?? "AE");
        const provider = profile.insuranceProviders.find(
          (p) => p.code === patient.insuranceProvider,
        );
        const network = provider?.networkTypes.find(
          (n) => n.code === patient.insuranceNetwork,
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
    preAuthRequired: true,
    providerName: patient.insuranceProvider,
    networkName: patient.insuranceNetwork ?? "",
  };
}
