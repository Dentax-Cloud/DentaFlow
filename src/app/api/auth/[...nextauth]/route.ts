/**
 * NextAuth catch-all route. Handles:
 *   GET  /api/auth/session
 *   POST /api/auth/callback/credentials
 *   GET  /api/auth/callback/google
 *   GET  /api/auth/signout
 *   etc.
 */

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
