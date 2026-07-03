import { UAE } from "./profiles/ae";
import { SAUDI } from "./profiles/sa";
import { QATAR } from "./profiles/qa";
import { BAHRAIN } from "./profiles/bh";
import { KUWAIT } from "./profiles/kw";
import { OMAN } from "./profiles/om";
import { UK } from "./profiles/gb";
import { USA } from "./profiles/us";
import { INDIA } from "./profiles/in";
import { SINGAPORE } from "./profiles/sg";
import { AUSTRALIA } from "./profiles/au";
import type { CountryProfile } from "./types";

export const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  AE: UAE,
  SA: SAUDI,
  QA: QATAR,
  BH: BAHRAIN,
  KW: KUWAIT,
  OM: OMAN,
  GB: UK,
  US: USA,
  IN: INDIA,
  SG: SINGAPORE,
  AU: AUSTRALIA,
};

export const SUPPORTED_COUNTRIES = Object.values(COUNTRY_PROFILES).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function getCountryProfile(countryCode: string): CountryProfile {
  return COUNTRY_PROFILES[countryCode.toUpperCase()] ?? UAE;
}

export function getCurrency(countryCode: string): string {
  return getCountryProfile(countryCode).currency;
}

export function getCurrencySymbol(countryCode: string): string {
  return getCountryProfile(countryCode).currencySymbol;
}

export function getTaxRate(countryCode: string): number {
  return getCountryProfile(countryCode).taxRate;
}

export function getTaxName(countryCode: string): string {
  return getCountryProfile(countryCode).taxName;
}

export function formatCurrency(amount: number, countryCode: string): string {
  const profile = getCountryProfile(countryCode);
  const formatted = new Intl.NumberFormat(profile.locale, {
    minimumFractionDigits: profile.currencyDecimals,
    maximumFractionDigits: profile.currencyDecimals,
  }).format(amount);
  return profile.currencyPosition === "before"
    ? `${profile.currencySymbol} ${formatted}`
    : `${formatted} ${profile.currencySymbol}`;
}

export function validateIdentityDocument(
  documentKey: string,
  value: string,
  countryCode: string,
): boolean {
  const profile = getCountryProfile(countryCode);
  const doc = profile.identityDocuments.find((d) => d.key === documentKey);
  if (!doc) return true;
  const regex = new RegExp(doc.regexStr);
  return regex.test(value);
}

export function formatPhone(phone: string, countryCode: string): string {
  const profile = getCountryProfile(countryCode);
  if (phone.startsWith("+")) return phone;
  return `${profile.dialCode}${phone.replace(/^0/, "")}`;
}

export function getInsuranceProviders(
  countryCode: string,
): CountryProfile["insuranceProviders"] {
  return getCountryProfile(countryCode).insuranceProviders;
}

export function getInsuranceNetworkTypes(
  countryCode: string,
  providerCode: string,
): CountryProfile["insuranceProviders"][0]["networkTypes"] {
  const providers = getInsuranceProviders(countryCode);
  return providers.find((p) => p.code === providerCode)?.networkTypes ?? [];
}

export function getToothNumbering(countryCode: string): string {
  return getCountryProfile(countryCode).toothNumbering;
}

export function getConsentAge(countryCode: string): number {
  return getCountryProfile(countryCode).consentAge;
}

export function getMandatoryFields(countryCode: string): string[] {
  return getCountryProfile(countryCode).mandatoryPatientFields;
}

export function isFieldMandatory(fieldKey: string, countryCode: string): boolean {
  return getMandatoryFields(countryCode).includes(fieldKey);
}

export function isPreAuthDefaultRequired(countryCode: string): boolean {
  return getCountryProfile(countryCode).insuranceModel.preAuthDefault;
}

export type {
  CountryProfile,
  IdentityDocument,
  PlatformInsuranceProvider,
  InsuranceNetworkType,
} from "./types";
