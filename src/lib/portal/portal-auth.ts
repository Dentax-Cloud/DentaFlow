import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import type { PatientPortalAccount, Patient } from "@prisma/client";

const PORTAL_JWT_SECRET = new TextEncoder().encode(
  (process.env.AUTH_SECRET ?? "") + "-portal-patient",
);

export type PortalJWTPayload = {
  sub: string;
  tenantId: string;
  patientId: string;
  tenantSlug: string;
  email: string;
  type: "PATIENT_PORTAL";
  iat: number;
  exp: number;
};

export async function signPortalJWT(
  payload: Omit<PortalJWTPayload, "type" | "iat" | "exp">,
): Promise<string> {
  return new SignJWT({
    ...payload,
    type: "PATIENT_PORTAL",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(PORTAL_JWT_SECRET);
}

export async function verifyPortalJWT(
  token: string,
): Promise<PortalJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, PORTAL_JWT_SECRET);
    if (payload.type !== "PATIENT_PORTAL") return null;
    return payload as unknown as PortalJWTPayload;
  } catch {
    return null;
  }
}

export async function getPortalSession(
  cookieValue: string | undefined,
  expectedSlug: string,
): Promise<PortalJWTPayload | null> {
  if (!cookieValue) return null;

  const payload = await verifyPortalJWT(cookieValue);
  if (!payload) return null;
  if (payload.tenantSlug !== expectedSlug) return null;

  return payload;
}

export async function generatePortalUserId(
  tenantCode: string,
  patientSeq: number,
): Promise<string> {
  return `PPU-${tenantCode}-${String(patientSeq).padStart(6, "0")}`;
}

export type PortalAccountWithPatient = PatientPortalAccount & {
  patient: Pick<Patient, "firstName" | "lastName" | "patientId">;
};

export async function createPortalAccount(input: {
  tenantId: string;
  patientId: string;
  email: string;
  password: string;
}): Promise<{ account: PatientPortalAccount; verifyToken: string }> {
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(input.password, 12);

  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: { branchSeq: true },
  });
  const tenant = await db.tenant.findUnique({
    where: { id: input.tenantId },
    select: { tenantCode: true },
  });

  const portalUserId = `PPU-${tenant?.tenantCode ?? "UNK"}-${String(patient?.branchSeq ?? 0).padStart(6, "0")}`;
  const verifyToken = randomBytes(32).toString("hex");
  const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const account = await db.patientPortalAccount.create({
    data: {
      tenantId: input.tenantId,
      patientId: input.patientId,
      email: input.email.toLowerCase().trim(),
      passwordHash,
      portalUserId,
      isVerified: false,
      verifyToken,
      verifyExpiry,
    },
  });

  return { account, verifyToken };
}

export async function authenticatePortalUser(input: {
  tenantId: string;
  email: string;
  password: string;
}): Promise<{
  success: boolean;
  account?: PortalAccountWithPatient;
  error?: string;
}> {
  const account = await db.patientPortalAccount.findFirst({
    where: {
      tenantId: input.tenantId,
      email: input.email.toLowerCase().trim(),
      isActive: true,
    },
    include: {
      patient: {
        select: { firstName: true, lastName: true, patientId: true },
      },
    },
  });

  if (!account) {
    return { success: false, error: "Invalid email or password" };
  }

  if (account.lockedUntil && account.lockedUntil > new Date()) {
    const mins = Math.ceil(
      (account.lockedUntil.getTime() - Date.now()) / 60000,
    );
    return {
      success: false,
      error: `Account locked. Try again in ${mins} minutes.`,
    };
  }

  const bcrypt = await import("bcryptjs");
  const valid = await bcrypt.compare(input.password, account.passwordHash);

  if (!valid) {
    const attempts = account.loginAttempts + 1;
    const locked = attempts >= 5;
    await db.patientPortalAccount.update({
      where: { id: account.id },
      data: {
        loginAttempts: attempts,
        lockedUntil: locked
          ? new Date(Date.now() + 15 * 60 * 1000)
          : null,
      },
    });
    return {
      success: false,
      error: locked
        ? "Too many failed attempts. Account locked for 15 minutes."
        : "Invalid email or password",
    };
  }

  await db.patientPortalAccount.update({
    where: { id: account.id },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  return { success: true, account };
}
