import { db } from "@/lib/db";
import { getCountryProfile } from "@/lib/countries";
import type { Prisma } from "@prisma/client";

export async function syncTenantCountryProfile(
  tenantId: string,
  countryCode: string,
): Promise<void> {
  const profile = getCountryProfile(countryCode);

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      countryCode,
      currency: profile.currency,
      currencySymbol: profile.currencySymbol,
      taxName: profile.taxName,
      taxRate: profile.taxRate,
      taxOnDental: profile.taxOnDental,
      regulatoryBody: profile.regulatoryBody,
      toothNumbering: profile.toothNumbering,
      defaultLanguage: profile.defaultLanguage,
      secondaryLanguage: profile.secondaryLanguage ?? null,
      dateFormat: profile.dateFormat,
      workingDays: profile.workingDays.join(","),
      primaryCodeSystem: profile.primaryCodeSystem,
      insuranceMandatory: profile.insuranceMandatory,
      hipaaRequired: profile.hipaaRequired,
      patientRetentionYrs: profile.patientRecordRetentionYears,
    },
  });

  const existingMethods = await db.tenantPaymentMethod.count({ where: { tenantId } });
  if (existingMethods === 0) {
    await db.tenantPaymentMethod.createMany({
      data: [
        { tenantId, name: "Cash", type: "CASH", sortOrder: 1, isDefault: true },
        { tenantId, name: "Card", type: "CARD", sortOrder: 2, isDefault: false },
        { tenantId, name: "Bank Transfer", type: "BANK", sortOrder: 3, isDefault: false },
        { tenantId, name: "Insurance", type: "INSURANCE", sortOrder: 4, isDefault: false },
      ],
      skipDuplicates: true,
    });
  }
}

export function mapDynamicFormToPatientData(
  values: Record<string, string>,
  countryCode: string,
): Prisma.PatientCreateInput {
  const idDocKey = Object.keys(values).find((k) => k.startsWith("idDoc_"));
  const idDocumentType = idDocKey ? idDocKey.replace("idDoc_", "") : values.idDocumentType;
  const idDocumentNumber = idDocKey ? values[idDocKey] : values.idDocumentNumber;

  return {
    countryCode,
    firstName: values.firstName?.trim() ?? "",
    lastName: values.lastName?.trim() ?? "",
    fatherName: values.fatherName?.trim() || null,
    grandfatherName: values.grandfatherName?.trim() || null,
    email: values.email?.trim() || null,
    phone: values.phone?.trim() || null,
    dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth) : null,
    gender: values.gender?.trim() || null,
    nationality: values.nationality?.trim() || null,
    maritalStatus: values.maritalStatus?.trim() || null,
    occupation: values.occupation?.trim() || null,
    employer: values.employer?.trim() || null,
    bloodGroup: values.bloodGroup?.trim() || null,
    idDocumentType: idDocumentType || null,
    idDocumentNumber: idDocumentNumber?.trim() || null,
    idDocumentExpiry: values.idDocumentExpiry ? new Date(values.idDocumentExpiry) : null,
    insuranceProvider: values.insuranceProvider?.trim() || null,
    insuranceNetwork: values.insuranceNetwork?.trim() || null,
    insurancePolicyNo: values.insurancePolicyNo?.trim() || null,
    insuranceMemberId: values.insuranceMemberId?.trim() || null,
    insuranceExpiry: values.insuranceExpiry ? new Date(values.insuranceExpiry) : null,
    emergencyContactName: values.emergencyContactName?.trim() || null,
    emergencyContactPhone: values.emergencyContactPhone?.trim() || null,
  } as Prisma.PatientCreateInput;
}

export function extractCustomFieldValues(
  values: Record<string, string>,
): Array<{ fieldKey: string; value: string }> {
  return Object.entries(values)
    .filter(([key]) => key.startsWith("custom_"))
    .map(([key, value]) => ({
      fieldKey: key.replace("custom_", ""),
      value,
    }));
}

type PatientFormSource = {
  firstName: string;
  lastName: string;
  fatherName?: string | null;
  grandfatherName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  occupation?: string | null;
  employer?: string | null;
  bloodGroup?: string | null;
  idDocumentType?: string | null;
  idDocumentNumber?: string | null;
  idDocumentExpiry?: Date | null;
  insuranceProvider?: string | null;
  insuranceNetwork?: string | null;
  insurancePolicyNo?: string | null;
  insuranceMemberId?: string | null;
  insuranceExpiry?: Date | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  customFieldValues?: Array<{ field: { fieldKey: string }; value: string | null }>;
};

function formatDateInput(value?: Date | null): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

/** Map a patient record to dynamic form values for edit mode. */
export function mapPatientToFormValues(patient: PatientFormSource): Record<string, string> {
  const values: Record<string, string> = {
    firstName: patient.firstName ?? "",
    lastName: patient.lastName ?? "",
    fatherName: patient.fatherName ?? "",
    grandfatherName: patient.grandfatherName ?? "",
    email: patient.email ?? "",
    phone: patient.phone ?? "",
    dateOfBirth: formatDateInput(patient.dateOfBirth),
    gender: patient.gender ?? "",
    nationality: patient.nationality ?? "",
    maritalStatus: patient.maritalStatus ?? "",
    occupation: patient.occupation ?? "",
    employer: patient.employer ?? "",
    bloodGroup: patient.bloodGroup ?? "",
    insuranceProvider: patient.insuranceProvider ?? "",
    insuranceNetwork: patient.insuranceNetwork ?? "",
    insurancePolicyNo: patient.insurancePolicyNo ?? "",
    insuranceMemberId: patient.insuranceMemberId ?? "",
    insuranceExpiry: formatDateInput(patient.insuranceExpiry),
    emergencyContactName: patient.emergencyContactName ?? "",
    emergencyContactPhone: patient.emergencyContactPhone ?? "",
    idDocumentExpiry: formatDateInput(patient.idDocumentExpiry),
  };

  if (patient.idDocumentType && patient.idDocumentNumber) {
    values[`idDoc_${patient.idDocumentType}`] = patient.idDocumentNumber;
  }

  for (const cv of patient.customFieldValues ?? []) {
    if (cv.value) {
      values[`custom_${cv.field.fieldKey}`] = cv.value;
    }
  }

  return values;
}
