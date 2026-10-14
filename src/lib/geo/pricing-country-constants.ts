/**
 * Shared constant, kept out of pricing-country-actions.ts on purpose: a "use server" file may
 * only export async functions, so a plain string constant has to live in its own module.
 */
export const PRICING_COUNTRY_OVERRIDE_COOKIE = "pricing_country_override";
