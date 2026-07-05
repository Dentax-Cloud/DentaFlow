"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { acceptEmailInvite, resolveEmailInviteToken } from "@/lib/tenant/team-invites";

export async function getInviteByToken(token: string) {
  if (!token) return null;
  return resolveEmailInviteToken(token);
}

const acceptSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

export async function acceptTeamInviteAction(input: z.infer<typeof acceptSchema>) {
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: "Invalid form data" };
  }

  const invite = await resolveEmailInviteToken(parsed.data.token);
  if (!invite) {
    return { success: false as const, error: "Invite link is invalid or expired" };
  }

  const email = parsed.data.email.toLowerCase().trim();
  if (email !== invite.email) {
    return { success: false as const, error: "Email must match the invited address" };
  }

  const existing = await db.auth_users.findUnique({ where: { email } });
  if (existing) {
    return { success: false as const, error: "An account with this email already exists. Sign in instead." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const authUser = await db.auth_users.create({
    data: {
      id: `auth_${randomUUID()}`,
      email,
      name: parsed.data.name,
      passwordHash,
    },
  });

  await acceptEmailInvite({
    token: parsed.data.token,
    authUserId: authUser.id,
    email,
    fullName: parsed.data.name,
  });

  return { success: true as const, email };
}
