"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  signPortalJWT,
  authenticatePortalUser,
  createPortalAccount,
} from "@/lib/portal/portal-auth";
import { sendMail } from "@/lib/mail";
import { checkRateLimit } from "@/lib/portal/rate-limit";

function portalBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
}

export async function loginToPortal(input: {
  slug: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  const rate = checkRateLimit(`portal-login:${input.slug}:${input.email.toLowerCase()}`, 8);
  if (!rate.allowed) {
    return { success: false, error: "Too many login attempts. Please try again later." };
  }

  const tenant = await db.tenant.findFirst({
    where: { slug: input.slug, portalEnabled: true },
    select: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    return { success: false, error: "Portal not available" };
  }

  const result = await authenticatePortalUser({
    tenantId: tenant.id,
    email: input.email,
    password: input.password,
  });

  if (!result.success || !result.account) {
    return { success: false, error: result.error };
  }

  const token = await signPortalJWT({
    sub: result.account.id,
    tenantId: tenant.id,
    patientId: result.account.patientId,
    tenantSlug: tenant.slug,
    email: result.account.email,
  });

  const cookieStore = await cookies();
  cookieStore.set(`portal_token_${input.slug}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60,
    path: `/portal/${input.slug}`,
  });

  return { success: true };
}

export async function lookupPatientByPortalId(input: {
  slug: string;
  patientId: string;
}): Promise<{ found: boolean; email?: string; name?: string }> {
  const rate = checkRateLimit(`portal-lookup:${input.slug}:${input.patientId}`, 20);
  if (!rate.allowed) return { found: false };

  const tenant = await db.tenant.findFirst({
    where: { slug: input.slug, portalEnabled: true },
    select: { id: true },
  });
  if (!tenant) return { found: false };

  const patient = await db.patient.findFirst({
    where: {
      tenantId: tenant.id,
      patientId: input.patientId.trim().toUpperCase(),
      deletedAt: null,
    },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!patient?.email) return { found: false };

  return {
    found: true,
    email: patient.email,
    name: `${patient.firstName} ${patient.lastName}`,
  };
}

export async function registerForPortal(input: {
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  idDocumentNumber?: string;
  password: string;
  formValues?: Record<string, string>;
}): Promise<{ success: boolean; error?: string }> {
  const rate = checkRateLimit(`portal-register:${input.slug}:${input.email.toLowerCase()}`, 5);
  if (!rate.allowed) {
    return { success: false, error: "Too many registration attempts. Please try again later." };
  }

  const tenant = await db.tenant.findFirst({
    where: { slug: input.slug, portalEnabled: true },
    select: { id: true, name: true, slug: true, email: true },
  });

  if (!tenant) return { success: false, error: "Portal not available" };

  const email = input.email.toLowerCase().trim();

  const existingAccount = await db.patientPortalAccount.findFirst({
    where: { tenantId: tenant.id, email },
  });

  if (existingAccount) {
    return {
      success: false,
      error: "An account with this email already exists. Please sign in.",
    };
  }

  const patient = await db.patient.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [
        { email },
        ...(input.idDocumentNumber
          ? [{ idDocumentNumber: input.idDocumentNumber }]
          : []),
        ...(input.dateOfBirth
          ? [
              {
                AND: [
                  { firstName: { equals: input.firstName, mode: "insensitive" as const } },
                  { lastName: { equals: input.lastName, mode: "insensitive" as const } },
                  { dateOfBirth: new Date(input.dateOfBirth) },
                ],
              },
            ]
          : []),
      ],
    },
  });

  if (!patient) {
    return {
      success: false,
      error:
        "No patient record found matching your details. Please contact the clinic to register as a patient first.",
    };
  }

  const patientHasAccount = await db.patientPortalAccount.findFirst({
    where: { tenantId: tenant.id, patientId: patient.id },
  });

  if (patientHasAccount) {
    return {
      success: false,
      error:
        "A portal account already exists for this patient. Please use forgot password if you cannot sign in.",
    };
  }

  const { verifyToken } = await createPortalAccount({
    tenantId: tenant.id,
    patientId: patient.id,
    email: input.email,
    password: input.password,
  });

  const verifyUrl = `${portalBaseUrl()}/portal/${input.slug}/verify?token=${verifyToken}`;
  await sendMail({
    to: input.email,
    subject: `Verify your ${tenant.name} portal account`,
    text: `Welcome to ${tenant.name} Patient Portal!

Please verify your email address by clicking the link below:
${verifyUrl}

This link expires in 24 hours.

If you did not register for this account, please ignore this email.

${tenant.name}`,
  }).catch(() => null);

  return { success: true };
}

export async function logoutFromPortal(slug: string) {
  const cookieStore = await cookies();
  cookieStore.delete(`portal_token_${slug}`);
}

export async function requestPasswordReset(input: {
  slug: string;
  email: string;
}): Promise<{ success: boolean }> {
  const rate = checkRateLimit(`portal-reset:${input.slug}:${input.email.toLowerCase()}`, 5);
  if (!rate.allowed) return { success: true };

  const tenant = await db.tenant.findFirst({
    where: { slug: input.slug },
    select: { id: true, name: true },
  });
  if (!tenant) return { success: true };

  const account = await db.patientPortalAccount.findFirst({
    where: { tenantId: tenant.id, email: input.email.toLowerCase() },
  });

  if (account) {
    const { randomBytes } = await import("crypto");
    const token = randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await db.patientPortalAccount.update({
      where: { id: account.id },
      data: { resetToken: token, resetExpiry: expiry },
    });

    const resetUrl = `${portalBaseUrl()}/portal/${input.slug}/reset-password?token=${token}`;
    await sendMail({
      to: input.email,
      subject: `Reset your ${tenant.name} portal password`,
      text: `Click the link below to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour.`,
    }).catch(() => null);
  }

  return { success: true };
}

export async function resetPortalPassword(input: {
  slug: string;
  token: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  const tenant = await db.tenant.findFirst({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (!tenant) return { success: false, error: "Invalid request" };

  const account = await db.patientPortalAccount.findFirst({
    where: {
      tenantId: tenant.id,
      resetToken: input.token,
      resetExpiry: { gt: new Date() },
    },
  });

  if (!account) {
    return { success: false, error: "Invalid or expired reset link" };
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(input.newPassword, 12);

  await db.patientPortalAccount.update({
    where: { id: account.id },
    data: {
      passwordHash,
      resetToken: null,
      resetExpiry: null,
      loginAttempts: 0,
      lockedUntil: null,
    },
  });

  return { success: true };
}

export async function verifyPortalEmail(input: {
  slug: string;
  token: string;
}): Promise<{ success: boolean; error?: string }> {
  const tenant = await db.tenant.findFirst({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (!tenant) return { success: false, error: "Invalid request" };

  const account = await db.patientPortalAccount.findFirst({
    where: {
      tenantId: tenant.id,
      verifyToken: input.token,
      verifyExpiry: { gt: new Date() },
    },
  });

  if (!account) {
    return { success: false, error: "Invalid or expired verification link" };
  }

  await db.patientPortalAccount.update({
    where: { id: account.id },
    data: {
      isVerified: true,
      verifyToken: null,
      verifyExpiry: null,
    },
  });

  return { success: true };
}

export async function updatePortalProfile(input: {
  slug: string;
  phone?: string;
  email?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { requirePortalContext } = await import("@/lib/portal/portal-context");
  const ctx = await requirePortalContext(input.slug);

  if (input.phone) {
    await db.patient.update({
      where: { id: ctx.patientId },
      data: { phone: input.phone },
    });
  }

  if (input.email && input.email !== ctx.email) {
    const taken = await db.patientPortalAccount.findFirst({
      where: {
        tenantId: ctx.tenantId,
        email: input.email.toLowerCase(),
        NOT: { id: ctx.accountId },
      },
    });
    if (taken) {
      return { success: false, error: "Email already in use" };
    }
    await db.patientPortalAccount.update({
      where: { id: ctx.accountId },
      data: { email: input.email.toLowerCase() },
    });
    await db.patient.update({
      where: { id: ctx.patientId },
      data: { email: input.email.toLowerCase() },
    });
  }

  return { success: true };
}

export async function changePortalPassword(input: {
  slug: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  const { requirePortalContext } = await import("@/lib/portal/portal-context");
  const ctx = await requirePortalContext(input.slug);

  const account = await db.patientPortalAccount.findFirst({
    where: { id: ctx.accountId, tenantId: ctx.tenantId },
  });
  if (!account) return { success: false, error: "Account not found" };

  const bcrypt = await import("bcryptjs");
  const valid = await bcrypt.compare(input.currentPassword, account.passwordHash);
  if (!valid) return { success: false, error: "Current password is incorrect" };

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await db.patientPortalAccount.update({
    where: { id: account.id },
    data: { passwordHash },
  });

  return { success: true };
}
