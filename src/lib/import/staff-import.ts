import { UserRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { getCountryProfile } from "@/lib/countries";
import { checkStaffLimit } from "@/lib/features/gate";
import { sendTeamInvite, storePendingTeamInvite } from "@/lib/tenant/team-invites";
import { formatRawImportValue } from "@/lib/import/parse-import-date";
import type { ImportFieldError, ImportMode, ImportRowResult } from "@/lib/import/import-types";

type ImportRow = Record<string, unknown>;

const CLINICAL_ROLES: UserRole[] = [
  UserRole.DOCTOR,
  UserRole.DENTIST,
  UserRole.HYGIENIST,
  UserRole.NURSE,
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cellValue(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return formatRawImportValue(value);
  return String(value).trim();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Resolve a role string to a UserRole. Exact case-insensitive match first,
 * then fuzzy contains match. Falls back to RECEPTIONIST with a warning reason.
 */
export function resolveImportStaffRole(rawRole: string): {
  role: UserRole;
  warning: ImportFieldError | null;
} {
  const trimmed = rawRole.trim();
  if (!trimmed) {
    return {
      role: UserRole.RECEPTIONIST,
      warning: {
        field: "role",
        rawValue: rawRole,
        reason: `Role is blank — assigned RECEPTIONIST as fallback. Will be saved as-is.`,
      },
    };
  }

  const enumValues = Object.values(UserRole) as string[];
  const exact = enumValues.find((r) => r.toLowerCase() === trimmed.toLowerCase());
  if (exact) {
    return { role: exact as UserRole, warning: null };
  }

  const fuzzy = enumValues.find(
    (r) =>
      r.toLowerCase().includes(trimmed.toLowerCase()) ||
      trimmed.toLowerCase().includes(r.toLowerCase()),
  );
  if (fuzzy) {
    return {
      role: fuzzy as UserRole,
      warning: {
        field: "role",
        rawValue: rawRole,
        reason: `Role "${rawRole}" did not exact-match — mapped to ${fuzzy}. Will be saved as-is.`,
      },
    };
  }

  return {
    role: UserRole.RECEPTIONIST,
    warning: {
      field: "role",
      rawValue: rawRole,
      reason: `Unknown role "${rawRole}" — assigned RECEPTIONIST as fallback. Will be saved as-is.`,
    },
  };
}

function checkPhoneFormat(phone: string, phoneRegexStr: string): ImportFieldError | null {
  if (!phone) return null;
  try {
    const regex = new RegExp(phoneRegexStr);
    if (!regex.test(phone.replace(/\s/g, ""))) {
      return {
        field: "phone",
        rawValue: phone,
        reason: `Phone "${phone}" does not match expected format. Will be saved as-is.`,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function resolveBranch(
  tenantId: string,
  branchName: string,
): Promise<{ branchId: string | null; warning: ImportFieldError | null }> {
  const branches = await db.branch.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, name: true, isPrimary: true },
    orderBy: { isPrimary: "desc" },
  });

  if (branches.length === 0) {
    return { branchId: null, warning: null };
  }

  const primary = branches.find((b) => b.isPrimary) ?? branches[0];

  if (!branchName) {
    if (branches.length > 1) {
      return {
        branchId: primary.id,
        warning: {
          field: "branchName",
          rawValue: "",
          reason: `No branch specified — defaulting to primary branch "${primary.name}". Will be saved as-is.`,
        },
      };
    }
    return { branchId: primary.id, warning: null };
  }

  const match = branches.find(
    (b) => b.name.toLowerCase() === branchName.toLowerCase(),
  );
  if (match) {
    return { branchId: match.id, warning: null };
  }

  return {
    branchId: primary.id,
    warning: {
      field: "branchName",
      rawValue: branchName,
      reason: `Branch "${branchName}" not found — defaulting to primary branch "${primary.name}". Will be saved as-is.`,
    },
  };
}

async function upsertDoctorProfile(
  tenantId: string,
  userId: string,
  specialty: string | null,
  licenseNo: string | null,
) {
  if (!specialty && !licenseNo) return;

  const existing = await db.doctor.findUnique({ where: { userId } });
  if (existing) {
    await db.doctor.update({
      where: { userId },
      data: {
        specialty: specialty ?? existing.specialty,
        licenseNo: licenseNo ?? existing.licenseNo,
      },
    });
    return;
  }

  await db.doctor.create({
    data: {
      tenantId,
      userId,
      specialty,
      licenseNo,
    },
  });
}

async function findStaffByEmail(tenantId: string, email: string) {
  return db.staffMember.findFirst({
    where: { tenantId, email, deletedAt: null },
    select: { id: true, authUserId: true, role: true },
  });
}

async function sendStaffInviteEmail(
  tenantId: string,
  email: string,
  role: UserRole,
  inviterName: string,
) {
  await storePendingTeamInvite(tenantId, email, role);
  await sendTeamInvite({
    tenantId,
    inviterName,
    email,
    role,
  });
}

export async function processStaffRow(input: {
  tenantId: string;
  row: ImportRow;
  rowNumber: number;
  mode: ImportMode;
  countryCode: string;
  inviterName: string;
  rollbackIds: string[];
}): Promise<ImportRowResult> {
  const { tenantId, row, rowNumber, mode, countryCode, inviterName, rollbackIds } =
    input;
  const profile = getCountryProfile(countryCode);
  const warningIssues: ImportFieldError[] = [];
  const warnings: string[] = [];

  if (cellValue(row.password)) {
    warningIssues.push({
      field: "password",
      rawValue: "[redacted]",
      reason: "Password column is ignored — staff will set their password via the invite link.",
    });
  }

  const emailRaw = cellValue(row.email);
  if (!emailRaw) {
    const fieldError: ImportFieldError = {
      field: "email",
      rawValue: formatRawImportValue(row.email),
      reason: "Email is required",
    };
    return {
      rowNumber,
      status: "ERROR",
      message: `${fieldError.field}: ${fieldError.reason}`,
      fieldErrors: [fieldError],
    };
  }

  const email = normalizeEmail(emailRaw);
  if (!EMAIL_RE.test(email)) {
    const fieldError: ImportFieldError = {
      field: "email",
      rawValue: emailRaw,
      reason: `Invalid email format: "${emailRaw}"`,
    };
    return {
      rowNumber,
      status: "ERROR",
      message: `${fieldError.field}: ${fieldError.reason}`,
      fieldErrors: [fieldError],
    };
  }

  const firstName = cellValue(row.firstName);
  const lastName = cellValue(row.lastName);
  if (!firstName) {
    const fieldError: ImportFieldError = {
      field: "firstName",
      rawValue: formatRawImportValue(row.firstName),
      reason: "First Name is required",
    };
    return {
      rowNumber,
      status: "ERROR",
      message: `${fieldError.field}: ${fieldError.reason}`,
      fieldErrors: [fieldError],
    };
  }
  if (!lastName) {
    const fieldError: ImportFieldError = {
      field: "lastName",
      rawValue: formatRawImportValue(row.lastName),
      reason: "Last Name is required",
    };
    return {
      rowNumber,
      status: "ERROR",
      message: `${fieldError.field}: ${fieldError.reason}`,
      fieldErrors: [fieldError],
    };
  }

  const roleRaw = cellValue(row.role);
  if (!roleRaw) {
    const fieldError: ImportFieldError = {
      field: "role",
      rawValue: formatRawImportValue(row.role),
      reason: "Role is required",
    };
    return {
      rowNumber,
      status: "ERROR",
      message: `${fieldError.field}: ${fieldError.reason}`,
      fieldErrors: [fieldError],
    };
  }

  const { role, warning: roleWarning } = resolveImportStaffRole(roleRaw);
  if (roleWarning) {
    warningIssues.push(roleWarning);
  }

  const phone = cellValue(row.phone);
  const phoneWarning = checkPhoneFormat(phone, profile.phoneRegexStr);
  if (phoneWarning) {
    warningIssues.push(phoneWarning);
  }

  const branchName = cellValue(row.branchName) || cellValue(row.branch);
  const { warning: branchWarning } = await resolveBranch(tenantId, branchName);
  if (branchWarning) {
    warningIssues.push(branchWarning);
  }

  const licenseNumber = cellValue(row.licenseNumber) || null;
  const specialization = cellValue(row.specialization) || null;

  const existing = await findStaffByEmail(tenantId, email);

  if (existing && mode === "CREATE_ONLY") {
    return {
      rowNumber,
      status: "ERROR",
      message: `email: A staff member with email "${email}" already exists`,
      fieldErrors: [
        {
          field: "email",
          rawValue: email,
          reason: "A staff member with this email already exists",
        },
      ],
    };
  }
  if (!existing && mode === "UPDATE_ONLY") {
    return {
      rowNumber,
      status: "SKIPPED",
      message: "Staff member not found (UPDATE_ONLY mode)",
      action: "SKIPPED",
    };
  }

  let staffMemberId: string;
  let action: "CREATED" | "UPDATED";

  if (existing) {
    await db.staffMember.update({
      where: { id: existing.id },
      data: {
        firstName,
        lastName,
        role,
      },
    });
    staffMemberId = existing.id;
    action = "UPDATED";

    if (CLINICAL_ROLES.includes(role)) {
      await upsertDoctorProfile(tenantId, staffMemberId, specialization, licenseNumber);
    }
  } else {
    try {
      await checkStaffLimit(tenantId);
    } catch (err) {
      return {
        rowNumber,
        status: "ERROR",
        message: err instanceof Error ? err.message : "Staff limit exceeded",
        fieldErrors: [
          {
            field: "email",
            rawValue: email,
            reason: err instanceof Error ? err.message : "Staff limit exceeded",
          },
        ],
      };
    }

    const created = await db.staffMember.create({
      data: {
        id: randomUUID(),
        tenantId,
        email,
        firstName,
        lastName,
        role,
        isActive: true,
      },
    });
    staffMemberId = created.id;
    action = "CREATED";
    rollbackIds.push(staffMemberId);

    if (CLINICAL_ROLES.includes(role)) {
      await upsertDoctorProfile(tenantId, staffMemberId, specialization, licenseNumber);
    }

    await sendStaffInviteEmail(tenantId, email, role, inviterName);
  }

  warnings.push(...warningIssues.map((issue) => issue.reason));

  return {
    rowNumber,
    status: warningIssues.length > 0 ? "WARNING" : "SUCCESS",
    warnings: warnings.length > 0 ? warnings : undefined,
    fieldErrors: warningIssues.length > 0 ? warningIssues : undefined,
    staffMemberId,
    action,
  };
}
