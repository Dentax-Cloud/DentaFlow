import type { CountryProfile } from "../types";
import {
  GCC_NAME_FIELDS,
  LUNAR_HOLIDAYS,
  selfPayProvider,
  tieredProvider,
} from "./shared";

export const OMAN: CountryProfile = {
  code: "OM",
  name: "Oman",
  nameAr: "عُمان",
  flag: "🇴🇲",
  region: "GCC",

  currency: "OMR",
  currencySymbol: "OMR",
  currencyPosition: "before",
  currencyDecimals: 3,

  taxName: "VAT",
  taxRate: 5,
  taxOnDental: true,
  taxNumberLabel: "VAT Registration Number",
  taxNumberRegexStr: "^\\d{15}$",
  taxNumberExample: "100123456700003",
  taxInvoiceRequired: true,
  taxInvoiceNotes: "Oman Tax Authority VAT invoice required",

  defaultLanguage: "ar",
  secondaryLanguage: "en",
  rtlDefault: true,
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
  locale: "ar-OM",

  dialCode: "+968",
  phoneFormat: "+968 XXXX XXXX",
  phoneRegexStr: "^\\+968[0-9]{8}$",
  phoneExample: "+968 9123 4567",

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
      labelAr: "البطاقة الشخصية",
      format: "XXXXXXXX",
      regexStr: "^[0-9]{8}$",
      mask: "________",
      mandatory: true,
      description: "Omani National/Resident Identity Card",
      example: "12345678",
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
  regulatoryBody: "MOH-OM",
  regulatoryBodyFull: "Ministry of Health Oman",
  primaryCodeSystem: "ICD10",

  insuranceMandatory: true,
  preAuthRequired: true,
  claimFormat: "Dhamani",
  insuranceProviders: [
    tieredProvider(
      "DHOFAR",
      "Dhofar Insurance",
      "Dhofar",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "ظفار للتأمين",
        claimEmail: "claims@dhofarinsurance.com",
      },
    ),
    tieredProvider(
      "OMAN_INS",
      "Oman Insurance Company",
      "OIC",
      [
        ["VIP", "VIP", 10, "كبار الشخصيات"],
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "شركة عُمان للتأمين",
        claimEmail: "claims@omaninsurance.com",
      },
    ),
    tieredProvider(
      "NATIONAL_LIFE",
      "National Life & General Insurance",
      "NLGIC",
      [
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "الوطنية للتأمين على الحياة والعام",
        claimEmail: "claims@nlgic.com",
      },
    ),
    tieredProvider(
      "MUSCAT_INS",
      "Muscat Insurance Company",
      "Muscat Ins",
      [
        ["GOLD", "Gold", 15, "ذهبي"],
        ["SILVER", "Silver", 20, "فضي"],
        ["BASIC", "Basic", 30, "أساسي"],
      ],
      {
        nameAr: "مسقط للتأمين",
        claimEmail: "claims@muscatinsurance.com",
      },
    ),
    selfPayProvider(),
  ],

  workingDays: ["SUN", "MON", "TUE", "WED", "THU"],
  weeklyHolyDay: "FRI",
  publicHolidays: [
    {
      id: "OM_NATIONAL",
      name: "National Day",
      nameAr: "اليوم الوطني",
      monthDay: "11-18",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "OM_RENAISSANCE",
      name: "Renaissance Day",
      nameAr: "يوم النهضة",
      monthDay: "07-23",
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
