import { GateAssertionError } from "@/lib/encounter/errors";
import {
  EncounterBillingGateError,
  EncounterDoubleInvoiceError,
} from "@/lib/encounter/billing";
import { InsufficientStockError } from "@/lib/inventory/deduct-store-stock";

/** Expected validation failures — return these instead of throwing so production Next.js does not mask them as Server Components digests. */
export type SpineActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Convert known validation errors to { ok: false }. Re-throw anything else
 * (DB failures, bugs) so they still surface as real errors.
 */
export function catchSpineExpectedFailure(e: unknown): SpineActionResult<never> {
  if (
    e instanceof GateAssertionError ||
    e instanceof EncounterBillingGateError ||
    e instanceof EncounterDoubleInvoiceError ||
    e instanceof InsufficientStockError
  ) {
    return { ok: false, error: e.message };
  }
  throw e;
}

/** try/catch wrapper used by Start / Close & Invoice server actions. */
export async function withSpineExpectedFailureCatch<T>(
  fn: () => Promise<T>,
): Promise<SpineActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return catchSpineExpectedFailure(e);
  }
}
