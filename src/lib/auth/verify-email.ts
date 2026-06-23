import { db } from "@/lib/db";

export async function verifyEmailToken(token: string): Promise<{ success: true } | { success: false; error: string }> {
  const record = await db.verification_tokens.findUnique({
    where: { token },
  });

  if (!record) {
    return { success: false, error: "Invalid or expired verification link." };
  }

  if (record.expires < new Date()) {
    await db.verification_tokens.delete({ where: { token } }).catch(() => null);
    return { success: false, error: "This verification link has expired." };
  }

  await db.auth_users.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });

  await db.verification_tokens.deleteMany({
    where: { identifier: record.identifier },
  });

  return { success: true };
}
