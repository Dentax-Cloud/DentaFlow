import type {
  CountryProfile,
  InsuranceNetworkType,
  PlatformInsuranceProvider,
  PublicHoliday,
} from "../types";

export const GCC_NAME_FIELDS = [
  {
    key: "firstName",
    label: "First Name",
    labelAr: "الاسم الأول",
    mandatory: true,
    placeholder: "e.g. Ahmed",
  },
  {
    key: "fatherName",
    label: "Father's Name",
    labelAr: "اسم الأب",
    mandatory: true,
    placeholder: "e.g. Mohammed",
  },
  {
    key: "grandfatherName",
    label: "Grandfather's Name",
    labelAr: "اسم الجد",
    mandatory: false,
    placeholder: "e.g. Abdullah",
  },
  {
    key: "lastName",
    label: "Family Name",
    labelAr: "اسم العائلة",
    mandatory: true,
    placeholder: "e.g. Al-Rashidi",
  },
] satisfies CountryProfile["nameFields"];

export const WESTERN_NAME_FIELDS = [
  { key: "firstName", label: "First Name", mandatory: true, placeholder: "e.g. John" },
  { key: "middleName", label: "Middle Name", mandatory: false, placeholder: "Optional" },
  { key: "lastName", label: "Last Name", mandatory: true, placeholder: "e.g. Smith" },
] satisfies CountryProfile["nameFields"];

export const INDIAN_NAME_FIELDS = [
  { key: "firstName", label: "First Name", mandatory: true, placeholder: "e.g. Raj" },
  { key: "lastName", label: "Last Name", mandatory: true, placeholder: "e.g. Kumar" },
  {
    key: "fatherName",
    label: "Father's Name",
    mandatory: false,
    placeholder: "Optional",
  },
] satisfies CountryProfile["nameFields"];

export const LUNAR_HOLIDAYS: PublicHoliday[] = [
  {
    id: "EID_FITR",
    name: "Eid Al Fitr",
    nameAr: "عيد الفطر",
    isLunar: true,
    lunarEvent: "EID_FITR",
    daysOff: 3,
  },
  {
    id: "EID_ADHA",
    name: "Eid Al Adha",
    nameAr: "عيد الأضحى",
    isLunar: true,
    lunarEvent: "EID_ADHA",
    daysOff: 3,
  },
  {
    id: "ISLAMIC_NY",
    name: "Islamic New Year",
    nameAr: "رأس السنة الهجرية",
    isLunar: true,
    lunarEvent: "ISLAMIC_NY",
    daysOff: 1,
  },
];

export function selfPayProvider(): PlatformInsuranceProvider {
  return {
    code: "SELF_PAY",
    name: "Self Pay / Cash",
    nameAr: "دفع ذاتي",
    shortName: "Cash",
    requiresPreAuth: false,
    networkTypes: [{ code: "CASH", name: "Cash", defaultCoPayPercent: 100 }],
  };
}

export function tieredProvider(
  code: string,
  name: string,
  shortName: string,
  tiers: Array<[string, string, number, string?]>,
  extras?: Partial<PlatformInsuranceProvider>,
): PlatformInsuranceProvider {
  return {
    code,
    name,
    shortName,
    requiresPreAuth: true,
    networkTypes: tiers.map(([c, n, coPay, nameAr]) => ({
      code: c,
      name: n,
      nameAr,
      defaultCoPayPercent: coPay,
    })),
    ...extras,
  };
}

export function standardNetworks(
  tiers: Array<[string, string, number]>,
): InsuranceNetworkType[] {
  return tiers.map(([code, name, defaultCoPayPercent]) => ({
    code,
    name,
    defaultCoPayPercent,
  }));
}

export const GCC_INSURANCE_MODEL = { preAuthDefault: true } as const;
export const DEFAULT_INSURANCE_MODEL = { preAuthDefault: false } as const;
