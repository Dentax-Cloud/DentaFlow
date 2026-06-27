import type { CountryProfile } from "../types";
import {
  GCC_NAME_FIELDS,
  LUNAR_HOLIDAYS,
  selfPayProvider,
  tieredProvider,
} from "./shared";

export const QATAR: CountryProfile = {
  code: "QA",
  name: "Qatar",
  nameAr: "قطر",
  flag: "🇶🇦",
  region: "GCC",

  currency: "QAR",
  currencySymbol: "QAR",
  currencyPosition: "before",
  currencyDecimals: 2,

  taxName: "None",
  taxRate: 0,
  taxOnDental: false,
  taxNumberLabel: "Tax Registration Number",
  taxInvoiceRequired: false,

  defaultLanguage: "ar",
  secondaryLanguage: "en",
  rtlDefault: true,
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
  locale: "ar-QA",

  dialCode: "+974",
  phoneFormat: "+974 XXXX XXXX",
  phoneRegexStr: "^\\+974[0-9]{8}$",
  phoneExample: "+974 3312 3456",

  nameFormat: "GCC_FOUR_PART",
  nameFields: GCC_NAME_FIELDS,

  mandatoryPatientFields: [
    "dateOfBirth",
    "gender",
    "phone",
    "idDocumentType",
    "idDocumentNumber",
    "nationality",
  ],
  optionalPatientFields: [
    "email",
    "occupation",
    "employer",
    "bloodGroup",
    "emergencyContactName",
    "emergencyContactPhone",
    "maritalStatus",
    "id2DocumentType",
    "id2DocumentNumber",
  ],

  identityDocuments: [
    {
      key: "QID",
      label: "Qatar ID (QID)",
      labelAr: "البطاقة القطرية",
      format: "28XXXXXXXX",
      regexStr: "^28[0-9]{8}$",
      mask: "28________",
      mandatory: true,
      description: "Qatar National/Resident Identity Card",
      example: "2812345678",
    },
    {
      key: "PASSPORT",
      label: "Passport",
      labelAr: "جواز السفر",
      format: "XX0000000",
      regexStr: "^[A-Z0-9]{6,9}$",
      mandatory: false,
      description: "For visitors and tourists",
      example: "A1234567",
    },
  ],

  toothNumbering: "FDI",
  consentAge: 18,
  regulatoryBody: "MOPH-QA",
  regulatoryBodyFull: "Ministry of Public Health Qatar",
  primaryCodeSystem: "ICD10",

  insuranceMandatory: true,
  preAuthRequired: true,
  claimFormat: "Seha",
  insuranceProviders: [
    tieredProvider(
      "SEHA",
      "Seha (Qatar Health Insurance Scheme)",
      "Seha",
      [
        ["COMPREHENSIVE", "Comprehensive", 0, "شامل"],
        ["STANDARD", "Standard", 20, "قياسي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "صحة",
        claimEmail: "claims@seha.gov.qa",
      },
    ),
    tieredProvider(
      "QIC",
      "Qatar Insurance Company",
      "QIC",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "شركة قطر للتأمين",
        claimEmail: "claims@qic.com.qa",
      },
    ),
    tieredProvider(
      "DOHA_INS",
      "Doha Insurance Group",
      "Doha Ins",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "مجموعة الدوحة للتأمين",
        claimEmail: "claims@dohainsurance.com",
      },
    ),
    tieredProvider(
      "AL_KHALIJ",
      "Al Khaleej Takaful Insurance",
      "Al Khaleej",
      [
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "الخليج للتأمين التكافلي",
        claimEmail: "claims@alkhaleej.com",
      },
    ),
    selfPayProvider(),
  ],

  workingDays: ["SUN", "MON", "TUE", "WED", "THU"],
  weeklyHolyDay: "FRI",
  publicHolidays: [
    {
      id: "QA_NATIONAL",
      name: "Qatar National Day",
      nameAr: "اليوم الوطني لقطر",
      monthDay: "12-18",
      isLunar: false,
      daysOff: 1,
    },
    ...LUNAR_HOLIDAYS,
  ],

  facilityLicenseRequired: true,
  electronicClaimRequired: true,
  patientRecordRetentionYears: 10,
  hipaaRequired: false,
};
