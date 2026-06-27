import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "USD") {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...options,
  }).format(new Date(date));
}

/** Stable date/time for SSR + client (fixed locale and timezone). */
export function formatDateTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
    ...options,
  }).format(new Date(date));
}

export function generatePatientNumber(sequence: number) {
  return `P${String(sequence).padStart(6, "0")}`;
}

export function generateInvoiceNumber(sequence: number) {
  return `INV-${String(sequence).padStart(6, "0")}`;
}
