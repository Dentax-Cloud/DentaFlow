import type { Prisma } from "@prisma/client";

export function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as Prisma.PrismaClientKnownRequestError).code === "P2002"
  );
}

/** Deterministic CommunicationLog id used to claim outbound worker sends. */
export function workerClaimLogId(kind: string, key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return `wclaim_${kind}_${safe}`;
}
