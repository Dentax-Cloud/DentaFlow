import type { CountryProfile } from "../types";
import {
  GCC_NAME_FIELDS,
  LUNAR_HOLIDAYS,
  selfPayProvider,
  tieredProvider,
} from "./shared";

export const SAUDI: CountryProfile = {
  code: "SA",
  name: "Saudi Arabia",
  nameAr: "المملكة العربية السعودية",
  flag: "🇸🇦",
  region: "GCC",

  currency: "SAR",
  currencySymbol: "SAR",
  currencyPosition: "before",
  currencyDecimals: 2,

  taxName: "VAT",
  taxRate: 15,
  taxOnDental: true,
  taxNumberLabel: "VAT Registration Number",
  taxNumberRegexStr: "^3\\d{14}$",
  taxNumberExample: "310123456700003",
  taxInvoiceRequired: true,
  taxInvoiceNotes: "ZATCA e-invoicing required for all taxable supplies",

  defaultLanguage: "ar",
  secondaryLanguage: "en",
  rtlDefault: true,
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
  locale: "ar-SA",

  dialCode: "+966",
  phoneFormat: "+966 5X XXX XXXX",
  phoneRegexStr: "^\\+9665[0-9]{8}$",
  phoneExample: "+966 50 123 4567",

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
      key: "NATIONAL_ID",
      label: "National ID",
      labelAr: "الهوية الوطنية",
      format: "1XXXXXXXXX",
      regexStr: "^1[0-9]{9}$",
      mask: "1_________",
      mandatory: true,
      description: "Saudi National ID for citizens",
      example: "1234567890",
    },
    {
      key: "IQAMA",
      label: "Iqama (Resident ID)",
      labelAr: "الإقامة",
      format: "2XXXXXXXXX",
      regexStr: "^2[0-9]{9}$",
      mask: "2_________",
      mandatory: false,
      description: "Resident identity card for expatriates",
      example: "2234567890",
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
  regulatoryBody: "CCHI/MOH-SA",
  regulatoryBodyFull:
    "Council of Cooperative Health Insurance / Ministry of Health Saudi Arabia",
  primaryCodeSystem: "ICD10",

  insuranceMandatory: true,
  preAuthRequired: true,
  claimFormat: "NPHIES",
  insuranceProviders: [
    tieredProvider(
      "BUPA_SA",
      "Bupa Arabia",
      "Bupa",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "بوبا العربية",
        claimEmail: "claims@bupa.com.sa",
      },
    ),
    tieredProvider(
      "TAWUNIYA",
      "Tawuniya",
      "Tawuniya",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "التعاونية للتأمين",
        claimEmail: "claims@tawuniya.com.sa",
      },
    ),
    tieredProvider(
      "MEDGULF",
      "Medgulf",
      "Medgulf",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "ميدغلف للتأمين",
        claimEmail: "claims@medgulf.com.sa",
      },
    ),
    tieredProvider(
      "AXA_COOP",
      "AXA Cooperative Insurance",
      "AXA",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "أكسا للتأمين التعاوني",
        claimEmail: "claims@axa-cooperative.com",
      },
    ),
    tieredProvider(
      "AL_RAJHI",
      "Al-Rajhi Takaful",
      "Al-Rajhi",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "تكافل الراجحي",
        claimEmail: "claims@alrajhitakaful.com",
      },
    ),
    tieredProvider(
      "SAICO",
      "Saudi Arabia Insurance",
      "SAICO",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "الشركة السعودية للتأمين",
        claimEmail: "claims@saico.com.sa",
      },
    ),
    tieredProvider(
      "WALAA",
      "Walaa Cooperative Insurance",
      "Walaa",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "ولاء للتأمين التعاوني",
        claimEmail: "claims@walaa.com",
      },
    ),
    tieredProvider(
      "GIG_GULF",
      "GIG Gulf Insurance",
      "GIG",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "جي آي جي الخليج للتأمين",
        claimEmail: "claims@giggulf.com",
      },
    ),
    selfPayProvider(),
  ],

  workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
  weeklyHolyDay: "FRI",
  publicHolidays: [
    {
      id: "SA_FOUNDING",
      name: "Founding Day",
      nameAr: "يوم التأسيس",
      monthDay: "02-22",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "SA_NATIONAL",
      name: "National Day",
      nameAr: "اليوم الوطني",
      monthDay: "09-23",
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
