/**
 * Node.js runtime for App Router segments that use Prisma or other Node-only APIs.
 *
 * Next.js segment config must use a string literal in each layout/page/route file:
 *   export const runtime = "nodejs";
 *
 * Do not re-export `runtime` from this module — Next.js will not pick it up.
 * Middleware always runs on the Edge runtime and must never import `@/lib/db`.
 */
export const NODEJS_RUNTIME = "nodejs" as const;
