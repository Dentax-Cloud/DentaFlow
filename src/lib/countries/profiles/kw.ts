import type { CountryProfile } from "../types";
import {
  GCC_NAME_FIELDS,
  GCC_INSURANCE_MODEL,
  LUNAR_HOLIDAYS,
  selfPayProvider,
  tieredProvider,
} from "./shared";

export const KUWAIT: CountryProfile = {
  code: "KW",
  name: "Kuwait",
  nameAr: "الكويت",
  flag: "🇰🇼",
  region: "GCC",

  currency: "KWD",
  currencySymbol: "KWD",
  currencyPosition: "before",
  currencyDecimals: 3,

  taxName: "None",
  taxRate: 0,
  taxOnDental: false,
  taxNumberLabel: "Commercial Registration",
  taxInvoiceRequired: false,

  defaultLanguage: "ar",
  secondaryLanguage: "en",
  rtlDefault: true,
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
  locale: "ar-KW",

  dialCode: "+965",
  phoneFormat: "+965 XXXX XXXX",
  phoneRegexStr: "^\\+965[0-9]{8}$",
  phoneExample: "+965 5012 3456",

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
      key: "CIVIL_ID",
      label: "Civil ID",
      labelAr: "البطاقة المدنية",
      format: "YYMMDDNNNN",
      regexStr: "^[0-9]{12}$",
      mask: "____________",
      mandatory: true,
      description: "Kuwait Civil Identification Card",
      example: "290010123456",
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
  regulatoryBody: "MOH-KW",
  regulatoryBodyFull: "Ministry of Health Kuwait",
  primaryCodeSystem: "ICD10",

  insuranceMandatory: true,
  preAuthRequired: true,
  insuranceModel: GCC_INSURANCE_MODEL,
  claimFormat: "MOH Kuwait",
  insuranceProviders: [
    tieredProvider(
      "GULF_INS",
      "Gulf Insurance Group",
      "GIG",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "مجموعة الخليج للتأمين",
        claimEmail: "claims@gig.com.kw",
      },
    ),
    tieredProvider(
      "WARBA",
      "Warba Insurance",
      "Warba",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "وربة للتأمين",
        claimEmail: "claims@warba.com",
      },
    ),
    tieredProvider(
      "KUWAIT_INS",
      "Kuwait Insurance Company",
      "KIC",
      [
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "شركة الكويت للتأمين",
        claimEmail: "claims@kic.com.kw",
      },
    ),
    tieredProvider(
      "AL_AHLIYA",
      "Al Ahleia Insurance",
      "Al Ahleia",
      [
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "الأهلية للتأمين",
        claimEmail: "claims@ahleia.com",
      },
    ),
    selfPayProvider(),
  ],

  workingDays: ["SUN", "MON", "TUE", "WED", "THU"],
  weeklyHolyDay: "FRI",
  publicHolidays: [
    {
      id: "KW_NATIONAL",
      name: "Kuwait National Day",
      nameAr: "اليوم الوطني للكويت",
      monthDay: "02-25",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "KW_LIBERATION",
      name: "Liberation Day",
      nameAr: "يوم التحرير",
      monthDay: "02-26",
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
