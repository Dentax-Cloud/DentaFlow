"use server";

import { db } from "@/lib/db";
import { sendEmailVerification } from "@/lib/auth/register-clinic";

/**
 * Resends the verification email for an unverified account.
 *
 * Always returns a generic success shape regardless of whether the email exists
 * or is already verified, so this endpoint can't be used to enumerate accounts.
 */
export async function resendVerificationEmailAction(emailRaw: string) {
  const email = emailRaw.toLowerCase().trim();
  if (!email) return { success: true as const };

  const user = await db.auth_users.findUnique({
    where: { email },
    select: { emailVerified: true },
  });

  if (user && !user.emailVerified) {
    await sendEmailVerification(email).catch((err) => {
      console.error("[resendVerificationEmail]", err);
    });
  }

  return { success: true as const };
}
