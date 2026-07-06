export type NameFormat = "WESTERN" | "GCC_FOUR_PART" | "INDIAN";
export type ToothNumbering = "FDI" | "UNIVERSAL" | "PALMER";
export type CurrencyPosition = "before" | "after";

export type NameField = {
  key: string;
  label: string;
  labelAr?: string;
  mandatory: boolean;
  placeholder?: string;
};

export type IdentityDocument = {
  key: string;
  label: string;
  labelAr?: string;
  format: string;
  regexStr: string;
  mask?: string;
  mandatory: boolean;
  description: string;
  example: string;
};

export type InsuranceNetworkType = {
  code: string;
  name: string;
  nameAr?: string;
  defaultCoPayPercent: number;
};

export type ClaimSubmissionMethodType =
  | "EMAIL"
  | "PORTAL"
  | "CLEARINGHOUSE"
  | "MANUAL";

export type PlatformInsuranceProvider = {
  code: string;
  name: string;
  nameAr?: string;
  shortName: string;
  networkTypes: InsuranceNetworkType[];
  requiresPreAuth: boolean;
  claimEmail?: string;
  claimSubmissionMethod?: ClaimSubmissionMethodType;
  claimsPortalUrl?: string;
  turnaroundDays?: number;
};

export type PublicHoliday = {
  id: string;
  name: string;
  nameAr?: string;
  monthDay?: string;
  isLunar: boolean;
  lunarEvent?: string;
  daysOff: number;
};

export type CustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "MULTISELECT"
  | "BOOLEAN"
  | "PHONE"
  | "EMAIL"
  | "TEXTAREA";

export type CountryProfile = {
  code: string;
  name: string;
  nameAr?: string;
  flag: string;
  region:
    | "GCC"
    | "EUROPE"
    | "NORTH_AMERICA"
    | "SOUTH_ASIA"
    | "SOUTHEAST_ASIA"
    | "OCEANIA"
    | "AFRICA";

  currency: string;
  currencySymbol: string;
  currencyPosition: CurrencyPosition;
  currencyDecimals: number;

  taxName: string;
  taxRate: number;
  taxOnDental: boolean;
  taxNumberLabel: string;
  taxNumberRegexStr?: string;
  taxNumberExample?: string;
  taxInvoiceRequired: boolean;
  taxInvoiceNotes?: string;

  defaultLanguage: string;
  secondaryLanguage?: string;
  rtlDefault: boolean;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  locale: string;

  dialCode: string;
  phoneFormat: string;
  phoneRegexStr: string;
  phoneExample: string;

  nameFormat: NameFormat;
  nameFields: NameField[];

  mandatoryPatientFields: string[];
  optionalPatientFields: string[];

  identityDocuments: IdentityDocument[];

  toothNumbering: ToothNumbering;
  consentAge: number;
  regulatoryBody: string;
  regulatoryBodyFull: string;
  primaryCodeSystem: "CDT" | "ICD10" | "SNOMED" | "MBS" | "ADA";

  insuranceMandatory: boolean;
  preAuthRequired: boolean;
  insuranceModel: {
    preAuthDefault: boolean;
  };
  claimFormat?: string;
  insuranceProviders: PlatformInsuranceProvider[];

  workingDays: string[];
  weeklyHolyDay?: string;
  publicHolidays: PublicHoliday[];

  facilityLicenseRequired: boolean;
  electronicClaimRequired: boolean;
  patientRecordRetentionYears: number;
  hipaaRequired: boolean;
};
