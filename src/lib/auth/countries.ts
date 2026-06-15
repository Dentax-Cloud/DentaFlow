export type CountryOption = {
  code: string;
  name: string;
  timezone: string;
  currency: string;
  taxLabel?: string;
  taxPlaceholder?: string;
  taxRequired?: boolean;
};

export const COUNTRY_OPTIONS: CountryOption[] = [
  {
    code: "AE",
    name: "United Arab Emirates",
    timezone: "Asia/Dubai",
    currency: "AED",
    taxLabel: "VAT / TRN Number",
    taxPlaceholder: "e.g. 100123456700003",
    taxRequired: true,
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    timezone: "Asia/Riyadh",
    currency: "SAR",
    taxLabel: "VAT Number",
    taxPlaceholder: "e.g. 310123456700003",
  },
  {
    code: "GB",
    name: "United Kingdom",
    timezone: "Europe/London",
    currency: "GBP",
    taxLabel: "VAT Number",
    taxPlaceholder: "e.g. GB123456789",
  },
  {
    code: "US",
    name: "United States",
    timezone: "America/New_York",
    currency: "USD",
    taxLabel: "EIN (optional)",
    taxPlaceholder: "e.g. 12-3456789",
  },
  {
    code: "IN",
    name: "India",
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxLabel: "GST Number",
    taxPlaceholder: "e.g. 22AAAAA0000A1Z5",
    taxRequired: true,
  },
  {
    code: "AU",
    name: "Australia",
    timezone: "Australia/Sydney",
    currency: "AUD",
    taxLabel: "ABN (optional)",
    taxPlaceholder: "e.g. 51 824 753 556",
  },
  {
    code: "CA",
    name: "Canada",
    timezone: "America/Toronto",
    currency: "CAD",
    taxLabel: "Business Number (optional)",
    taxPlaceholder: "e.g. 123456789 RC0001",
  },
  {
    code: "DE",
    name: "Germany",
    timezone: "Europe/Berlin",
    currency: "EUR",
    taxLabel: "USt-IdNr (optional)",
    taxPlaceholder: "e.g. DE123456789",
  },
];

export const TIMEZONE_OPTIONS = [
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
  "UTC",
] as const;

export const SPECIALTY_OPTIONS = [
  "General Dentistry",
  "Orthodontics",
  "Dental Implants",
  "Periodontics",
  "Endodontics",
  "Prosthodontics",
  "Pediatric Dentistry",
  "Oral Surgery",
  "Cosmetic Dentistry",
  "Preventive Care",
] as const;

export const MONTHLY_PATIENT_OPTIONS = [
  { value: "under-50", label: "Under 50 patients" },
  { value: "50-150", label: "50 – 150 patients" },
  { value: "150-300", label: "150 – 300 patients" },
  { value: "300-500", label: "300 – 500 patients" },
  { value: "500-plus", label: "500+ patients" },
] as const;

export const REFERRAL_SOURCES = [
  "Google Search",
  "Social Media",
  "Colleague / Referral",
  "Dental Conference",
  "Existing DentaFlow Customer",
  "Other",
] as const;

export function getCountryByCode(code: string): CountryOption | undefined {
  return COUNTRY_OPTIONS.find((c) => c.code === code);
}

export const PENDING_REGISTRATION_KEY = "dentaflow_pending_registration";
