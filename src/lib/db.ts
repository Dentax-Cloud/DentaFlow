import { PrismaClient } from "@prisma/client";

const PRISMA_INIT_HINT =
  "Prisma Client is not initialized. Run `pnpm db:generate` and restart the dev server.";

declare global {
  // eslint-disable-next-line no-var
  var __dentaflowPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  try {
    return new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["warn", "error"]
          : ["error"],
    });
  } catch (error) {
    console.error(`[prisma] ${PRISMA_INIT_HINT}`, error);
    throw new Error(PRISMA_INIT_HINT, { cause: error });
  }
}

/** Node.js runtime only — never import from middleware or Edge routes. */
export const db = globalThis.__dentaflowPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__dentaflowPrisma = db;
}
