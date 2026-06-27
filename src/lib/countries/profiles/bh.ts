import type { CountryProfile } from "../types";
import {
  GCC_NAME_FIELDS,
  LUNAR_HOLIDAYS,
  selfPayProvider,
  tieredProvider,
} from "./shared";

export const BAHRAIN: CountryProfile = {
  code: "BH",
  name: "Bahrain",
  nameAr: "البحرين",
  flag: "🇧🇭",
  region: "GCC",

  currency: "BHD",
  currencySymbol: "BHD",
  currencyPosition: "before",
  currencyDecimals: 3,

  taxName: "VAT",
  taxRate: 10,
  taxOnDental: true,
  taxNumberLabel: "VAT Registration Number",
  taxNumberRegexStr: "^\\d{15}$",
  taxNumberExample: "200123456700003",
  taxInvoiceRequired: true,
  taxInvoiceNotes: "NBR VAT invoice required for taxable supplies",

  defaultLanguage: "ar",
  secondaryLanguage: "en",
  rtlDefault: true,
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
  locale: "ar-BH",

  dialCode: "+973",
  phoneFormat: "+973 XXXX XXXX",
  phoneRegexStr: "^\\+973[0-9]{8}$",
  phoneExample: "+973 3312 3456",

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
      key: "CPR",
      label: "CPR (Central Population Registry)",
      labelAr: "السجل المركزي للسكان",
      format: "YYMMDDNNNN",
      regexStr: "^[0-9]{9}$",
      mask: "_________",
      mandatory: true,
      description: "Bahrain Central Population Registry number",
      example: "900112345",
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
  regulatoryBody: "NHRA-BH",
  regulatoryBodyFull: "National Health Regulatory Authority Bahrain",
  primaryCodeSystem: "ICD10",

  insuranceMandatory: true,
  preAuthRequired: true,
  claimFormat: "NHRA eClaim",
  insuranceProviders: [
    tieredProvider(
      "SOLIDARITY",
      "Solidarity Bahrain",
      "Solidarity",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "سوليدرتي البحرين",
        claimEmail: "claims@solidarity.com.bh",
      },
    ),
    tieredProvider(
      "GIG_BH",
      "GIG Bahrain",
      "GIG",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "جي آي جي البحرين",
        claimEmail: "claims@gigbh.com",
      },
    ),
    tieredProvider(
      "SNIC",
      "Saudi National Insurance Company (Bahrain)",
      "SNIC",
      [
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "الشركة السعودية الوطنية للتأمين",
        claimEmail: "claims@snic.com.bh",
      },
    ),
    tieredProvider(
      "AXA_BH",
      "AXA Insurance Bahrain",
      "AXA",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "أكسا للتأمين البحرين",
        claimEmail: "claims@axa-bahrain.com",
      },
    ),
    selfPayProvider(),
  ],

  workingDays: ["SUN", "MON", "TUE", "WED", "THU"],
  weeklyHolyDay: "FRI",
  publicHolidays: [
    {
      id: "BH_NATIONAL",
      name: "Bahrain National Day",
      nameAr: "اليوم الوطني للبحرين",
      monthDay: "12-16",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "BH_ACCD",
      name: "Accession Day",
      nameAr: "يوم الجلوس",
      monthDay: "12-17",
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
