import type { CountryProfile } from "../types";
import { selfPayProvider, tieredProvider, WESTERN_NAME_FIELDS } from "./shared";

export const SINGAPORE: CountryProfile = {
  code: "SG",
  name: "Singapore",
  flag: "🇸🇬",
  region: "SOUTHEAST_ASIA",

  currency: "SGD",
  currencySymbol: "S$",
  currencyPosition: "before",
  currencyDecimals: 2,

  taxName: "GST",
  taxRate: 9,
  taxOnDental: true,
  taxNumberLabel: "GST Registration Number",
  taxNumberRegexStr: "^[A-Z][0-9]{9}[A-Z]$",
  taxNumberExample: "M12345678X",
  taxInvoiceRequired: true,
  taxInvoiceNotes: "IRAS GST tax invoice required for taxable supplies",

  defaultLanguage: "en",
  secondaryLanguage: "zh",
  rtlDefault: false,
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
  locale: "en-SG",

  dialCode: "+65",
  phoneFormat: "+65 XXXX XXXX",
  phoneRegexStr: "^\\+65[689][0-9]{7}$",
  phoneExample: "+65 9123 4567",

  nameFormat: "WESTERN",
  nameFields: WESTERN_NAME_FIELDS,

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
    "medisaveAccount",
  ],

  identityDocuments: [
    {
      key: "NRIC",
      label: "NRIC / FIN",
      format: "SXXXXXXXA",
      regexStr: "^[STFGM][0-9]{7}[A-Z]$",
      mask: "S_______A",
      mandatory: true,
      description: "National Registration Identity Card or Foreign Identification Number",
      example: "S1234567A",
    },
    {
      key: "PASSPORT",
      label: "Passport",
      format: "XX0000000",
      regexStr: "^[A-Z0-9]{6,9}$",
      mandatory: false,
      description: "For visitors and tourists",
      example: "E1234567",
    },
  ],

  toothNumbering: "FDI",
  consentAge: 21,
  regulatoryBody: "MOH-SG/SDC",
  regulatoryBodyFull:
    "Ministry of Health Singapore / Singapore Dental Council",
  primaryCodeSystem: "ICD10",

  insuranceMandatory: false,
  preAuthRequired: true,
  claimFormat: "Medisave / Shield",
  insuranceProviders: [
    tieredProvider(
      "AIA_SG",
      "AIA Singapore",
      "AIA",
      [
        ["PREMIER", "Premier", 10],
        ["STANDARD", "Standard", 20],
        ["BASIC", "Basic", 30],
      ],
      { claimEmail: "claims@aia.com.sg" },
    ),
    tieredProvider(
      "GREAT_EASTERN",
      "Great Eastern Life",
      "Great Eastern",
      [
        ["PREMIER", "Premier", 10],
        ["STANDARD", "Standard", 20],
        ["BASIC", "Basic", 30],
      ],
      { claimEmail: "claims@greateasternlife.com" },
    ),
    tieredProvider(
      "PRUDENTIAL_SG",
      "Prudential Singapore",
      "Prudential",
      [
        ["PREMIER", "Premier", 10],
        ["STANDARD", "Standard", 20],
        ["BASIC", "Basic", 30],
      ],
      { claimEmail: "claims@prudential.com.sg" },
    ),
    tieredProvider(
      "NTUC_INCOME",
      "NTUC Income",
      "Income",
      [
        ["COMPREHENSIVE", "Comprehensive", 10],
        ["STANDARD", "Standard", 20],
        ["BASIC", "Basic", 30],
      ],
      { claimEmail: "claims@income.com.sg" },
    ),
    tieredProvider(
      "MEDISHIELD",
      "MediShield Life",
      "MediShield",
      [
        ["LIFE", "MediShield Life", 0],
        ["INTEGRATED", "Integrated Shield", 10],
      ],
      { claimEmail: "claims@cpf.gov.sg" },
    ),
    selfPayProvider(),
  ],

  workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
  publicHolidays: [
    {
      id: "SG_NY",
      name: "New Year's Day",
      monthDay: "01-01",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "SG_NATIONAL",
      name: "National Day",
      monthDay: "08-09",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "SG_CHRISTMAS",
      name: "Christmas Day",
      monthDay: "12-25",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "SG_CNY",
      name: "Chinese New Year",
      isLunar: true,
      lunarEvent: "CNY",
      daysOff: 2,
    },
    {
      id: "SG_DEEPAVALI",
      name: "Deepavali",
      isLunar: true,
      lunarEvent: "DEEPAVALI",
      daysOff: 1,
    },
    {
      id: "SG_HARI_RAYA",
      name: "Hari Raya Puasa",
      isLunar: true,
      lunarEvent: "EID_FITR",
      daysOff: 1,
    },
  ],

  facilityLicenseRequired: true,
  electronicClaimRequired: true,
  patientRecordRetentionYears: 7,
  hipaaRequired: false,
};
