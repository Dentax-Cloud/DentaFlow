import { db } from "@/lib/db";
import { getCountryProfile, SUPPORTED_COUNTRIES } from "./index";
import type { CountryProfile } from "./types";

export type PatientFormField = {
  key: string;
  label: string;
  labelAr?: string;
  type: "text" | "select" | "date" | "phone" | "email" | "textarea";
  mandatory: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string; labelAr?: string }>;
  validation?: { regex?: string; message?: string };
  section: "IDENTITY" | "CONTACT" | "INSURANCE" | "MEDICAL" | "ADDITIONAL";
  isCustom: boolean;
  helpText?: string;
};

export async function buildPatientFormFields(
  tenantId: string,
  countryCode: string,
  options?: { portalOnly?: boolean },
): Promise<PatientFormField[]> {
  const profile = getCountryProfile(countryCode);
  const fields: PatientFormField[] = [];

  for (const nameField of profile.nameFields) {
    fields.push({
      key: nameField.key,
      label: nameField.label,
      labelAr: nameField.labelAr,
      type: "text",
      mandatory: nameField.mandatory,
      placeholder: nameField.placeholder,
      section: "IDENTITY",
      isCustom: false,
    });
  }

  fields.push(
    {
      key: "dateOfBirth",
      label: "Date of Birth",
      labelAr: "تاريخ الميلاد",
      type: "date",
      mandatory: profile.mandatoryPatientFields.includes("dateOfBirth"),
      section: "IDENTITY",
      isCustom: false,
    },
    {
      key: "gender",
      label: "Gender",
      labelAr: "الجنس",
      type: "select",
      mandatory: profile.mandatoryPatientFields.includes("gender"),
      options: [
        { value: "MALE", label: "Male", labelAr: "ذكر" },
        { value: "FEMALE", label: "Female", labelAr: "أنثى" },
        { value: "OTHER", label: "Other", labelAr: "آخر" },
      ],
      section: "IDENTITY",
      isCustom: false,
    },
  );

  for (const doc of profile.identityDocuments) {
    fields.push({
      key: `idDoc_${doc.key}`,
      label: doc.label,
      labelAr: doc.labelAr,
      type: "text",
      mandatory: doc.mandatory,
      placeholder: doc.example,
      validation: { regex: doc.regexStr, message: `Format: ${doc.format}` },
      helpText: doc.description,
      section: "IDENTITY",
      isCustom: false,
    });
  }

  if (
    profile.mandatoryPatientFields.includes("nationality") ||
    profile.optionalPatientFields.includes("nationality")
  ) {
    fields.push({
      key: "nationality",
      label: "Nationality",
      labelAr: "الجنسية",
      type: "select",
      mandatory: profile.mandatoryPatientFields.includes("nationality"),
      options: SUPPORTED_COUNTRIES.map((c) => ({
        value: c.code,
        label: c.name,
      })),
      section: "IDENTITY",
      isCustom: false,
    });
  }

  fields.push(
    {
      key: "phone",
      label: "Phone",
      labelAr: "الهاتف",
      type: "phone",
      mandatory: profile.mandatoryPatientFields.includes("phone"),
      placeholder: profile.phoneExample,
      section: "CONTACT",
      isCustom: false,
    },
    {
      key: "email",
      label: "Email",
      labelAr: "البريد الإلكتروني",
      type: "email",
      mandatory: profile.mandatoryPatientFields.includes("email"),
      section: "CONTACT",
      isCustom: false,
    },
  );

  if (profile.insuranceMandatory || profile.insuranceProviders.length > 0) {
    fields.push(
      {
        key: "insuranceProvider",
        label: "Insurance Provider",
        labelAr: "شركة التأمين",
        type: "select",
        mandatory: profile.insuranceMandatory,
        options: profile.insuranceProviders.map((p) => ({
          value: p.code,
          label: p.name,
          labelAr: p.nameAr,
        })),
        section: "INSURANCE",
        isCustom: false,
      },
      {
        key: "insuranceNetwork",
        label: "Insurance Network / Plan",
        labelAr: "شبكة التأمين",
        type: "select",
        mandatory: false,
        options: [],
        section: "INSURANCE",
        isCustom: false,
        helpText: "Select insurance provider first",
      },
      {
        key: "insuranceMemberId",
        label: "Insurance Member ID",
        labelAr: "رقم العضوية",
        type: "text",
        mandatory: false,
        section: "INSURANCE",
        isCustom: false,
      },
      {
        key: "insurancePolicyNo",
        label: "Policy Number",
        labelAr: "رقم الوثيقة",
        type: "text",
        mandatory: false,
        section: "INSURANCE",
        isCustom: false,
      },
      {
        key: "insuranceExpiry",
        label: "Insurance Expiry",
        labelAr: "تاريخ انتهاء التأمين",
        type: "date",
        mandatory: false,
        section: "INSURANCE",
        isCustom: false,
      },
    );
  }

  for (const fieldKey of profile.optionalPatientFields) {
    if (fields.find((f) => f.key === fieldKey)) continue;
    if (fieldKey === "bloodGroup") {
      fields.push({
        key: "bloodGroup",
        label: "Blood Group",
        labelAr: "فصيلة الدم",
        type: "select",
        mandatory: false,
        options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => ({
          value: bg,
          label: bg,
        })),
        section: "MEDICAL",
        isCustom: false,
      });
    } else if (fieldKey === "occupation") {
      fields.push({
        key: "occupation",
        label: "Occupation",
        labelAr: "المهنة",
        type: "text",
        mandatory: false,
        section: "ADDITIONAL",
        isCustom: false,
      });
    } else if (fieldKey === "employer") {
      fields.push({
        key: "employer",
        label: "Employer",
        labelAr: "جهة العمل",
        type: "text",
        mandatory: false,
        section: "ADDITIONAL",
        isCustom: false,
      });
    } else if (fieldKey === "emergencyContactName") {
      fields.push({
        key: "emergencyContactName",
        label: "Emergency Contact Name",
        labelAr: "اسم جهة الاتصال للطوارئ",
        type: "text",
        mandatory: false,
        section: "CONTACT",
        isCustom: false,
      });
    } else if (fieldKey === "emergencyContactPhone") {
      fields.push({
        key: "emergencyContactPhone",
        label: "Emergency Contact Phone",
        labelAr: "هاتف جهة الاتصال للطوارئ",
        type: "phone",
        mandatory: false,
        section: "CONTACT",
        isCustom: false,
      });
    } else if (fieldKey === "maritalStatus") {
      fields.push({
        key: "maritalStatus",
        label: "Marital Status",
        labelAr: "الحالة الاجتماعية",
        type: "select",
        mandatory: false,
        options: [
          { value: "SINGLE", label: "Single" },
          { value: "MARRIED", label: "Married" },
          { value: "DIVORCED", label: "Divorced" },
          { value: "WIDOWED", label: "Widowed" },
        ],
        section: "ADDITIONAL",
        isCustom: false,
      });
    }
  }

  const customFields = await db.tenantCustomField.findMany({
    where: {
      tenantId,
      entity: "PATIENT",
      isActive: true,
      ...(options?.portalOnly ? { isPortalVisible: true } : {}),
    },
    orderBy: { sortOrder: "asc" },
  });

  for (const cf of customFields) {
    const fieldType = cf.fieldType.toLowerCase();
    const allowedTypes = ["text", "select", "date", "phone", "email", "textarea"] as const;
    const type = allowedTypes.includes(fieldType as (typeof allowedTypes)[number])
      ? (fieldType as PatientFormField["type"])
      : "text";

    fields.push({
      key: `custom_${cf.fieldKey}`,
      label: cf.fieldLabel,
      labelAr: cf.fieldLabelAr ?? undefined,
      type,
      mandatory: cf.isRequired,
      options: (cf.options as PatientFormField["options"]) ?? undefined,
      helpText: cf.helpText ?? undefined,
      section: cf.section as PatientFormField["section"],
      isCustom: true,
    });
  }

  return fields;
}

export type { CountryProfile };
