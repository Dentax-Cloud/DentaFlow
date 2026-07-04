import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

export const TEST_SLUG_PREFIX = "test-";
export const TEST_PASSWORD = "Test1234!";
export const TEST_EMAIL_DOMAIN = "test.dentaflow.io";

export type TestClinicDef = {
  slug: string;
  countryCode: "IN" | "US" | "GB" | "AE";
  name: string;
  city: string;
  timezone: string;
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  /** Seed a second branch (direct DB — bypasses UI gate for over-limit STARTER testing). */
  extraBranch?: boolean;
};

export const TEST_CLINICS: TestClinicDef[] = [
  // India × 5
  {
    slug: "test-in-smilecraft",
    countryCode: "IN",
    name: "SmileCraft Dental Clinic",
    city: "Mumbai",
    timezone: "Asia/Kolkata",
    plan: "STARTER",
    subscriptionStatus: "TRIALING",
  },
  {
    slug: "test-in-pearl",
    countryCode: "IN",
    name: "Pearl Dental Care",
    city: "Delhi",
    timezone: "Asia/Kolkata",
    plan: "STARTER",
    subscriptionStatus: "ACTIVE",
    extraBranch: true,
  },
  {
    slug: "test-in-lotus",
    countryCode: "IN",
    name: "Lotus Oral Health",
    city: "Bangalore",
    timezone: "Asia/Kolkata",
    plan: "PROFESSIONAL",
    subscriptionStatus: "ACTIVE",
  },
  {
    slug: "test-in-heritage",
    countryCode: "IN",
    name: "Heritage Smiles",
    city: "Chennai",
    timezone: "Asia/Kolkata",
    plan: "PROFESSIONAL",
    subscriptionStatus: "TRIALING",
  },
  {
    slug: "test-in-kapoor",
    countryCode: "IN",
    name: "Dr. Kapoor's Family Dentistry",
    city: "Pune",
    timezone: "Asia/Kolkata",
    plan: "ENTERPRISE",
    subscriptionStatus: "ACTIVE",
  },
  // United States × 5
  {
    slug: "test-us-riverside",
    countryCode: "US",
    name: "Riverside Family Dental",
    city: "Portland",
    timezone: "America/Los_Angeles",
    plan: "STARTER",
    subscriptionStatus: "ACTIVE",
  },
  {
    slug: "test-us-lakewood",
    countryCode: "US",
    name: "Lakewood Dental Studio",
    city: "Denver",
    timezone: "America/Denver",
    plan: "STARTER",
    subscriptionStatus: "TRIALING",
  },
  {
    slug: "test-us-brightbite",
    countryCode: "US",
    name: "Bright Bite Dentistry",
    city: "Austin",
    timezone: "America/Chicago",
    plan: "PROFESSIONAL",
    subscriptionStatus: "ACTIVE",
  },
  {
    slug: "test-us-harbor",
    countryCode: "US",
    name: "Harbor View Dental Group",
    city: "Boston",
    timezone: "America/New_York",
    plan: "ENTERPRISE",
    subscriptionStatus: "ACTIVE",
    extraBranch: true,
  },
  {
    slug: "test-us-sunset",
    countryCode: "US",
    name: "Sunset Smiles Pediatric Dental",
    city: "San Diego",
    timezone: "America/Los_Angeles",
    plan: "ENTERPRISE",
    subscriptionStatus: "TRIALING",
  },
  // United Kingdom × 5
  {
    slug: "test-gb-wilmslow",
    countryCode: "GB",
    name: "The Wilmslow Dental Practice",
    city: "Wilmslow",
    timezone: "Europe/London",
    plan: "STARTER",
    subscriptionStatus: "TRIALING",
  },
  {
    slug: "test-gb-kensington",
    countryCode: "GB",
    name: "Kensington Smile Studio",
    city: "London",
    timezone: "Europe/London",
    plan: "PROFESSIONAL",
    subscriptionStatus: "ACTIVE",
  },
  {
    slug: "test-gb-edinburgh",
    countryCode: "GB",
    name: "Edinburgh Dental Associates",
    city: "Edinburgh",
    timezone: "Europe/London",
    plan: "PROFESSIONAL",
    subscriptionStatus: "ACTIVE",
  },
  {
    slug: "test-gb-bristol",
    countryCode: "GB",
    name: "Bristol Harbour Dental",
    city: "Bristol",
    timezone: "Europe/London",
    plan: "ENTERPRISE",
    subscriptionStatus: "ACTIVE",
  },
  {
    slug: "test-gb-camden",
    countryCode: "GB",
    name: "Camden Oral Care Centre",
    city: "London",
    timezone: "Europe/London",
    plan: "STARTER",
    subscriptionStatus: "ACTIVE",
  },
  // UAE × 5
  {
    slug: "test-ae-alnoor",
    countryCode: "AE",
    name: "Al Noor Dental Clinic",
    city: "Dubai",
    timezone: "Asia/Dubai",
    plan: "STARTER",
    subscriptionStatus: "ACTIVE",
  },
  {
    slug: "test-ae-marina",
    countryCode: "AE",
    name: "Marina Smile Lounge",
    city: "Abu Dhabi",
    timezone: "Asia/Dubai",
    plan: "PROFESSIONAL",
    subscriptionStatus: "TRIALING",
  },
  {
    slug: "test-ae-jumeirah",
    countryCode: "AE",
    name: "Jumeirah Dental Specialists",
    city: "Dubai",
    timezone: "Asia/Dubai",
    plan: "ENTERPRISE",
    subscriptionStatus: "ACTIVE",
    extraBranch: true,
  },
  {
    slug: "test-ae-sharjah",
    countryCode: "AE",
    name: "Sharjah Family Dental",
    city: "Sharjah",
    timezone: "Asia/Dubai",
    plan: "PROFESSIONAL",
    subscriptionStatus: "ACTIVE",
  },
  {
    slug: "test-ae-oasis",
    countryCode: "AE",
    name: "Oasis Dental Centre",
    city: "Ajman",
    timezone: "Asia/Dubai",
    plan: "ENTERPRISE",
    subscriptionStatus: "ACTIVE",
  },
];
