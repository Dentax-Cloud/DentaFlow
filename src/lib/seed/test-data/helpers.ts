import { TEST_EMAIL_DOMAIN, TEST_SLUG_PREFIX } from "./catalog";

/** Deterministic pseudo-random for reproducible test data. */
export function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function pickInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function daysFromNow(days: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const FIRST_NAMES: Record<string, string[]> = {
  IN: [
    "Priya", "Arjun", "Ananya", "Rahul", "Kavya", "Vikram", "Meera", "Sanjay",
    "Divya", "Amit", "Neha", "Rohan", "Pooja", "Karthik", "Shreya",
  ],
  US: [
    "Emily", "Michael", "Sarah", "James", "Jessica", "David", "Ashley", "Robert",
    "Amanda", "Christopher", "Jennifer", "Daniel", "Lauren", "Matthew", "Nicole",
  ],
  GB: [
    "Oliver", "Amelia", "Harry", "Isla", "George", "Ava", "Jack", "Emily",
    "Noah", "Sophia", "Arthur", "Grace", "Leo", "Mia", "Henry",
  ],
  AE: [
    "Fatima", "Ahmed", "Mariam", "Omar", "Layla", "Khalid", "Aisha", "Hassan",
    "Noor", "Youssef", "Sara", "Rashid", "Huda", "Saeed", "Amira",
  ],
};

const LAST_NAMES: Record<string, string[]> = {
  IN: [
    "Sharma", "Patel", "Reddy", "Iyer", "Gupta", "Khan", "Nair", "Singh",
    "Menon", "Joshi", "Desai", "Rao", "Malhotra", "Verma", "Chopra",
  ],
  US: [
    "Johnson", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor",
    "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson",
  ],
  GB: [
    "Smith", "Jones", "Williams", "Taylor", "Brown", "Davies", "Evans", "Wilson",
    "Thomas", "Roberts", "Johnson", "Walker", "Wright", "Thompson", "Green",
  ],
  AE: [
    "Al Farsi", "Al Maktoum", "Al Nahyan", "Hassan", "Khalil", "Al Mansoori",
    "Ibrahim", "Al Suwaidi", "Mahmoud", "Al Zaabi", "Nasser", "Al Shamsi",
  ],
};

export function randomPersonName(
  rng: () => number,
  countryCode: string,
): { firstName: string; lastName: string } {
  const cc = countryCode in FIRST_NAMES ? countryCode : "US";
  return {
    firstName: pick(rng, FIRST_NAMES[cc]!),
    lastName: pick(rng, LAST_NAMES[cc]!),
  };
}

export function ownerEmailForSlug(slug: string): string {
  const local = slug.replace(TEST_SLUG_PREFIX, "").replace(/-/g, ".");
  return `owner.${local}@${TEST_EMAIL_DOMAIN}`;
}

export function staffEmailForSlug(slug: string, role: string, index = 0): string {
  const local = slug.replace(TEST_SLUG_PREFIX, "").replace(/-/g, ".");
  const suffix = index > 0 ? `.${index}` : "";
  return `${role.toLowerCase()}${suffix}.${local}@${TEST_EMAIL_DOMAIN}`;
}

export function identityDocForCountry(
  countryCode: string,
  index: number,
): { type: string; number: string } {
  switch (countryCode) {
    case "IN":
      return {
        type: "AADHAAR",
        number: String(234567890000 + index).slice(0, 12),
      };
    case "US":
      return {
        type: "SSN",
        number: `123-45-${String(6000 + index).padStart(4, "0")}`,
      };
    case "GB":
      return {
        type: "NHS_NUMBER",
        number: String(9434765900 + index).slice(0, 10),
      };
    case "AE":
      return {
        type: "EMIRATES_ID",
        number: `784-1990-${String(1234560 + index).padStart(7, "0")}-${index % 10}`,
      };
    default:
      return { type: "PASSPORT", number: `P${100000 + index}` };
  }
}

/** Base selling prices by GPMR category, per country currency. */
const CATEGORY_PRICE_BASE: Record<string, Record<string, number>> = {
  AE: {
    DIAGNOSTIC: 250,
    PREVENTIVE: 350,
    RESTORATIVE: 600,
    ENDODONTICS: 1800,
    PERIODONTICS: 900,
    ORAL_SURGERY: 700,
    PROSTHODONTICS: 3500,
    IMPLANTOLOGY: 8000,
    ORTHODONTICS: 12000,
    COSMETIC: 1500,
    PAEDIATRIC: 300,
    EMERGENCY: 500,
    ANAESTHESIA: 400,
    APPLIANCES: 2000,
    DEFAULT: 400,
  },
  US: {
    DIAGNOSTIC: 95,
    PREVENTIVE: 140,
    RESTORATIVE: 280,
    ENDODONTICS: 850,
    PERIODONTICS: 420,
    ORAL_SURGERY: 320,
    PROSTHODONTICS: 1400,
    IMPLANTOLOGY: 3200,
    ORTHODONTICS: 4800,
    COSMETIC: 650,
    PAEDIATRIC: 120,
    EMERGENCY: 220,
    ANAESTHESIA: 180,
    APPLIANCES: 900,
    DEFAULT: 175,
  },
  GB: {
    DIAGNOSTIC: 65,
    PREVENTIVE: 85,
    RESTORATIVE: 180,
    ENDODONTICS: 550,
    PERIODONTICS: 280,
    ORAL_SURGERY: 210,
    PROSTHODONTICS: 950,
    IMPLANTOLOGY: 2200,
    ORTHODONTICS: 3200,
    COSMETIC: 450,
    PAEDIATRIC: 75,
    EMERGENCY: 150,
    ANAESTHESIA: 120,
    APPLIANCES: 650,
    DEFAULT: 110,
  },
  IN: {
    DIAGNOSTIC: 800,
    PREVENTIVE: 1200,
    RESTORATIVE: 2500,
    ENDODONTICS: 6500,
    PERIODONTICS: 3500,
    ORAL_SURGERY: 2800,
    PROSTHODONTICS: 12000,
    IMPLANTOLOGY: 35000,
    ORTHODONTICS: 45000,
    COSMETIC: 8000,
    PAEDIATRIC: 900,
    EMERGENCY: 1500,
    ANAESTHESIA: 1200,
    APPLIANCES: 15000,
    DEFAULT: 1500,
  },
};

export function priceForCategory(
  countryCode: string,
  category: string | null | undefined,
  rng: () => number,
): number {
  const table = CATEGORY_PRICE_BASE[countryCode] ?? CATEGORY_PRICE_BASE.US!;
  const base = table[category ?? ""] ?? table.DEFAULT ?? 200;
  const jitter = 0.85 + rng() * 0.3;
  return Math.round(base * jitter);
}
