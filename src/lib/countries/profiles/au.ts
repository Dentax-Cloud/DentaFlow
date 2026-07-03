import type { CountryProfile } from "../types";
import { selfPayProvider, tieredProvider, WESTERN_NAME_FIELDS, DEFAULT_INSURANCE_MODEL } from "./shared";

export const AUSTRALIA: CountryProfile = {
  code: "AU",
  name: "Australia",
  flag: "🇦🇺",
  region: "OCEANIA",

  currency: "AUD",
  currencySymbol: "A$",
  currencyPosition: "before",
  currencyDecimals: 2,

  taxName: "GST",
  taxRate: 10,
  taxOnDental: false,
  taxNumberLabel: "ABN (Australian Business Number)",
  taxNumberRegexStr: "^[0-9]{11}$",
  taxNumberExample: "51824753556",
  taxInvoiceRequired: false,
  taxInvoiceNotes: "Most dental services are GST-free in Australia",

  defaultLanguage: "en",
  rtlDefault: false,
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
  locale: "en-AU",

  dialCode: "+61",
  phoneFormat: "+61 X XXXX XXXX",
  phoneRegexStr: "^\\+61[2-478][0-9]{8}$",
  phoneExample: "+61 4 1234 5678",

  nameFormat: "WESTERN",
  nameFields: WESTERN_NAME_FIELDS,

  mandatoryPatientFields: [
    "dateOfBirth",
    "gender",
    "phone",
    "address",
    "medicareNumber",
  ],
  optionalPatientFields: [
    "email",
    "occupation",
    "employer",
    "bloodGroup",
    "emergencyContactName",
    "emergencyContactPhone",
    "maritalStatus",
    "medicareIRN",
    "privateHealthFund",
    "privateHealthMemberNumber",
  ],

  identityDocuments: [
    {
      key: "MEDICARE",
      label: "Medicare Card",
      format: "XXXX XXXXX X",
      regexStr: "^[0-9]{10}$",
      mask: "____ _____ _",
      mandatory: false,
      description: "Australian Medicare card number (10 digits)",
      example: "2123456701",
    },
    {
      key: "DRIVERS_LICENCE",
      label: "Driver's Licence",
      format: "State-specific",
      regexStr: "^[A-Z0-9]{6,12}$",
      mandatory: false,
      description: "State-issued driver's licence",
      example: "12345678",
    },
    {
      key: "PASSPORT",
      label: "Passport",
      format: "N0000000",
      regexStr: "^[A-Z]{1,2}[0-9]{7}$",
      mandatory: false,
      description: "Australian passport number",
      example: "N1234567",
    },
  ],

  toothNumbering: "FDI",
  consentAge: 18,
  regulatoryBody: "AHPRA",
  regulatoryBodyFull:
    "Australian Health Practitioner Regulation Agency",
  primaryCodeSystem: "MBS",

  insuranceMandatory: false,
  preAuthRequired: false,
  insuranceModel: DEFAULT_INSURANCE_MODEL,
  claimFormat: "Medicare / Private Health",
  insuranceProviders: [
    {
      code: "MEDICARE",
      name: "Medicare Australia",
      shortName: "Medicare",
      requiresPreAuth: false,
      networkTypes: [
        { code: "GENERAL", name: "General Dental (MBS)", defaultCoPayPercent: 0 },
        { code: "CHILD", name: "Child Dental Benefits Schedule", defaultCoPayPercent: 0 },
      ],
    },
    tieredProvider(
      "MEDIBANK",
      "Medibank Private",
      "Medibank",
      [
        ["GOLD", "Gold", 10],
        ["SILVER", "Silver", 20],
        ["BASIC", "Basic", 30],
      ],
      { claimEmail: "claims@medibank.com.au" },
    ),
    tieredProvider(
      "BUPA_AU",
      "Bupa Australia",
      "Bupa",
      [
        ["GOLD", "Gold", 10],
        ["SILVER", "Silver", 20],
        ["BASIC", "Basic", 30],
      ],
      { claimEmail: "claims@bupa.com.au" },
    ),
    tieredProvider(
      "HCF",
      "HCF Health Insurance",
      "HCF",
      [
        ["GOLD", "Gold", 10],
        ["SILVER", "Silver", 20],
        ["BASIC", "Basic", 30],
      ],
      { claimEmail: "claims@hcf.com.au" },
    ),
    tieredProvider(
      "NIB",
      "nib Health Funds",
      "nib",
      [
        ["GOLD", "Gold", 10],
        ["SILVER", "Silver", 20],
        ["BASIC", "Basic", 30],
      ],
      { claimEmail: "claims@nib.com.au" },
    ),
    tieredProvider(
      "AHM",
      "ahm Health Insurance",
      "ahm",
      [
        ["STANDARD", "Standard", 20],
        ["BASIC", "Basic", 30],
      ],
      { claimEmail: "claims@ahm.com.au" },
    ),
    selfPayProvider(),
  ],

  workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
  publicHolidays: [
    {
      id: "AU_NY",
      name: "New Year's Day",
      monthDay: "01-01",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "AU_AUSTRALIA_DAY",
      name: "Australia Day",
      monthDay: "01-26",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "AU_ANZAC",
      name: "Anzac Day",
      monthDay: "04-25",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "AU_QUEENS",
      name: "King's Birthday",
      monthDay: "06-10",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "AU_CHRISTMAS",
      name: "Christmas Day",
      monthDay: "12-25",
      isLunar: false,
      daysOff: 1,
    },
    {
      id: "AU_BOXING",
      name: "Boxing Day",
      monthDay: "12-26",
      isLunar: false,
      daysOff: 1,
    },
  ],

  facilityLicenseRequired: true,
  electronicClaimRequired: true,
  patientRecordRetentionYears: 7,
  hipaaRequired: false,
};
