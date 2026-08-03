"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/rbac/guard";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { createAuditLog } from "@/lib/actions/safe-action";
import { isHrModuleEnabled } from "@/lib/hr/feature-flag";
import { inclusiveDayCount, computeLeaveBalance } from "@/lib/hr/leave";
import {
  credentialExpiryWindowDays,
  isCredentialExpiringSoon,
} from "@/lib/hr/credential-expiry";
import { tenantWhere } from "@/lib/tenant/scoped";

const HR_DISABLED = "HR module is not enabled for this clinic";

async function requireHrEnabled() {
  const ctx = await requireTenantContext();
  if (!isHrModuleEnabled(ctx.tenant)) throw new Error(HR_DISABLED);
  return ctx;
}

async function requireHrWrite() {
  const ctx = await requireHrEnabled();
  await requirePermission(PERMISSIONS.hr.write);
  return ctx;
}

async function requireHrRead() {
  const ctx = await requireHrEnabled();
  await requirePermission(PERMISSIONS.hr.read);
  return ctx;
}

/** Linked Employee for the current staff member, or null. */
export async function getLinkedEmployeeForCurrentUser() {
  const ctx = await requireHrEnabled();
  if (!ctx.staffMember?.id) return null;
  return db.employee.findFirst({
    where: {
      tenantId: ctx.tenantId,
      staffMemberId: ctx.staffMember.id,
      deletedAt: null,
    },
  });
}

async function assertCanAccessEmployee(employeeId: string, mode: "read" | "write") {
  const ctx = await requireHrEnabled();
  const employee = await db.employee.findFirst({
    where: tenantWhere(ctx.tenantId, { id: employeeId, deletedAt: null }),
  });
  if (!employee) throw new Error("Employee not found");

  const role = ctx.staffMember?.role;
  if (!role) throw new Error("FORBIDDEN");
  const isHrWrite = hasPermission(role, PERMISSIONS.hr.write);
  const isHrRead =
    hasPermission(role, PERMISSIONS.hr.read) || isHrWrite;
  const isSelf =
    !!ctx.staffMember?.id && employee.staffMemberId === ctx.staffMember.id;

  if (mode === "write") {
    // Master employee record edits require hr.write (not self-service).
    if (!isHrWrite) throw new Error("FORBIDDEN");
  } else if (!isHrRead && !isSelf) {
    throw new Error("FORBIDDEN");
  }

  return { ctx, employee, isSelf, isHr: isHrRead };
}

function revalidateHr(employeeId?: string) {
  revalidatePath("/hr");
  revalidatePath("/hr/me");
  revalidatePath("/hr/leave");
  revalidatePath("/hr/departments");
  revalidatePath("/hr/leave-types");
  if (employeeId) revalidatePath(`/hr/employees/${employeeId}`);
}

// ─── Departments ───────────────────────────────────────────────

export async function createDepartment(input: { name: string; description?: string }) {
  const ctx = await requireHrWrite();
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const row = await db.department.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      description: input.description?.trim() || null,
    },
  });
  await createAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.staffMember?.id,
    action: AuditAction.CREATE,
    entity: "Department",
    entityId: row.id,
  });
  revalidateHr();
  return row;
}

export async function updateDepartment(input: {
  id: string;
  name?: string;
  description?: string | null;
}) {
  const ctx = await requireHrWrite();
  const existing = await db.department.findFirst({
    where: tenantWhere(ctx.tenantId, { id: input.id, deletedAt: null }),
  });
  if (!existing) throw new Error("Department not found");
  const row = await db.department.update({
    where: { id: existing.id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
    },
  });
  revalidateHr();
  return row;
}

export async function listDepartments() {
  const ctx = await requireHrRead();
  return db.department.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

// ─── Employees ─────────────────────────────────────────────────

export async function createEmployee(input: {
  firstName: string;
  lastName: string;
  email?: string;
  jobTitle?: string;
  departmentId?: string | null;
  staffMemberId?: string | null;
  employmentType?: string;
  employmentStatus?: string;
  hireDate: string;
  compensationNote?: string;
}) {
  const ctx = await requireHrWrite();
  if (!input.firstName.trim() || !input.lastName.trim()) {
    throw new Error("Name is required");
  }
  if (input.staffMemberId) {
    const staff = await db.staffMember.findFirst({
      where: {
        id: input.staffMemberId,
        tenantId: ctx.tenantId,
        deletedAt: null,
      },
    });
    if (!staff) throw new Error("Staff member not found");
    const taken = await db.employee.findFirst({
      where: { staffMemberId: input.staffMemberId, deletedAt: null },
    });
    if (taken) throw new Error("Staff member already linked to an employee");
  }
  if (input.departmentId) {
    const dept = await db.department.findFirst({
      where: tenantWhere(ctx.tenantId, { id: input.departmentId, deletedAt: null }),
    });
    if (!dept) throw new Error("Department not found");
  }

  const row = await db.employee.create({
    data: {
      tenantId: ctx.tenantId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email?.trim() || null,
      jobTitle: input.jobTitle?.trim() || null,
      departmentId: input.departmentId || null,
      staffMemberId: input.staffMemberId || null,
      employmentType: input.employmentType ?? "salaried",
      employmentStatus: input.employmentStatus ?? "active",
      hireDate: new Date(input.hireDate),
      compensationNote: input.compensationNote?.trim() || null,
    },
  });
  await createAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.staffMember?.id,
    action: AuditAction.CREATE,
    entity: "Employee",
    entityId: row.id,
  });
  revalidateHr(row.id);
  return row;
}

export async function updateEmployee(input: {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  jobTitle?: string | null;
  departmentId?: string | null;
  staffMemberId?: string | null;
  employmentType?: string;
  employmentStatus?: string;
  hireDate?: string;
  terminationDate?: string | null;
  compensationNote?: string | null;
}) {
  await assertCanAccessEmployee(input.id, "write");
  const ctx = await requireHrWrite();
  const row = await db.employee.update({
    where: { id: input.id },
    data: {
      ...(input.firstName != null ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName != null ? { lastName: input.lastName.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(input.jobTitle !== undefined
        ? { jobTitle: input.jobTitle?.trim() || null }
        : {}),
      ...(input.departmentId !== undefined
        ? { departmentId: input.departmentId || null }
        : {}),
      ...(input.staffMemberId !== undefined
        ? { staffMemberId: input.staffMemberId || null }
        : {}),
      ...(input.employmentType != null ? { employmentType: input.employmentType } : {}),
      ...(input.employmentStatus != null
        ? { employmentStatus: input.employmentStatus }
        : {}),
      ...(input.hireDate != null ? { hireDate: new Date(input.hireDate) } : {}),
      ...(input.terminationDate !== undefined
        ? {
            terminationDate: input.terminationDate
              ? new Date(input.terminationDate)
              : null,
          }
        : {}),
      ...(input.compensationNote !== undefined
        ? { compensationNote: input.compensationNote?.trim() || null }
        : {}),
    },
  });
  await createAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.staffMember?.id,
    action: AuditAction.UPDATE,
    entity: "Employee",
    entityId: row.id,
  });
  revalidateHr(row.id);
  return row;
}

export async function softDeleteEmployee(id: string) {
  const ctx = await requireHrWrite();
  const existing = await db.employee.findFirst({
    where: tenantWhere(ctx.tenantId, { id, deletedAt: null }),
  });
  if (!existing) throw new Error("Employee not found");
  await db.employee.update({
    where: { id },
    data: { deletedAt: new Date(), employmentStatus: "terminated" },
  });
  await createAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.staffMember?.id,
    action: AuditAction.DELETE,
    entity: "Employee",
    entityId: id,
  });
  revalidateHr(id);
  return { ok: true as const };
}

export async function listEmployees(filters?: {
  departmentId?: string;
  employmentType?: string;
  employmentStatus?: string;
  search?: string;
}) {
  const ctx = await requireHrRead();
  const search = filters?.search?.trim();
  return db.employee.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters?.employmentType ? { employmentType: filters.employmentType } : {}),
      ...(filters?.employmentStatus
        ? { employmentStatus: filters.employmentStatus }
        : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { jobTitle: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { department: { select: { id: true, name: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

// ─── Documents ─────────────────────────────────────────────────

export async function registerEmployeeDocument(input: {
  employeeId: string;
  documentType: string;
  title: string;
  fileUrl: string;
  fileName?: string;
  mimeType?: string;
  expiresAt?: string | null;
}) {
  const { ctx, employee, isSelf } = await assertCanAccessEmployee(
    input.employeeId,
    "read",
  );
  const canWriteHr =
    ctx.staffMember?.role &&
    hasPermission(ctx.staffMember.role, PERMISSIONS.hr.write);
  if (!canWriteHr && !isSelf) throw new Error("FORBIDDEN");
  if (!/^https?:\/\//i.test(input.fileUrl)) throw new Error("Invalid file URL");

  const row = await db.employeeDocument.create({
    data: {
      tenantId: ctx.tenantId,
      employeeId: employee.id,
      documentType: input.documentType || "other",
      title: input.title.trim() || "Document",
      fileUrl: input.fileUrl.trim(),
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      uploadedById: ctx.staffMember?.id ?? null,
    },
  });
  revalidateHr(employee.id);
  return row;
}

export async function listExpiringCredentials() {
  const ctx = await requireHrRead();
  const windowDays = credentialExpiryWindowDays();
  const docs = await db.employeeDocument.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      expiresAt: { not: null },
      documentType: { in: ["credential", "id"] },
      employee: { deletedAt: null },
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  const now = new Date();
  return docs
    .filter((d) => isCredentialExpiringSoon(d.expiresAt, now, windowDays))
    .map((d) => ({
      id: d.id,
      title: d.title,
      expiresAt: d.expiresAt!.toISOString(),
      employeeId: d.employee.id,
      employeeName: `${d.employee.firstName} ${d.employee.lastName}`,
    }));
}

// ─── Time entries ──────────────────────────────────────────────

export async function clockIn(input?: { notes?: string }) {
  const ctx = await requireHrEnabled();
  const me = await getLinkedEmployeeForCurrentUser();
  if (!me) throw new Error("No linked employee record");
  const open = await db.timeEntry.findFirst({
    where: {
      tenantId: ctx.tenantId,
      employeeId: me.id,
      clockOutAt: null,
      deletedAt: null,
    },
  });
  if (open) throw new Error("Already clocked in");
  const row = await db.timeEntry.create({
    data: {
      tenantId: ctx.tenantId,
      employeeId: me.id,
      clockInAt: new Date(),
      source: "clock_punch",
      notes: input?.notes?.trim() || null,
      status: "pending",
    },
  });
  revalidateHr(me.id);
  return row;
}

export async function clockOut() {
  const ctx = await requireHrEnabled();
  const me = await getLinkedEmployeeForCurrentUser();
  if (!me) throw new Error("No linked employee record");
  const open = await db.timeEntry.findFirst({
    where: {
      tenantId: ctx.tenantId,
      employeeId: me.id,
      clockOutAt: null,
      deletedAt: null,
    },
    orderBy: { clockInAt: "desc" },
  });
  if (!open) throw new Error("Not clocked in");
  const row = await db.timeEntry.update({
    where: { id: open.id },
    data: { clockOutAt: new Date() },
  });
  revalidateHr(me.id);
  return row;
}

export async function createManualTimeEntry(input: {
  employeeId: string;
  clockInAt: string;
  clockOutAt?: string | null;
  breakMinutes?: number;
  notes?: string;
}) {
  const { ctx, employee, isSelf } = await assertCanAccessEmployee(
    input.employeeId,
    "read",
  );
  const canWriteHr =
    ctx.staffMember?.role &&
    hasPermission(ctx.staffMember.role, PERMISSIONS.hr.write);
  if (!canWriteHr && !isSelf) throw new Error("FORBIDDEN");

  const row = await db.timeEntry.create({
    data: {
      tenantId: ctx.tenantId,
      employeeId: employee.id,
      clockInAt: new Date(input.clockInAt),
      clockOutAt: input.clockOutAt ? new Date(input.clockOutAt) : null,
      breakMinutes: input.breakMinutes ?? 0,
      source: "manual",
      notes: input.notes?.trim() || null,
      status: "pending",
    },
  });
  revalidateHr(employee.id);
  return row;
}

export async function approveTimeEntry(id: string) {
  const ctx = await requireHrWrite();
  const entry = await db.timeEntry.findFirst({
    where: tenantWhere(ctx.tenantId, { id, deletedAt: null }),
  });
  if (!entry) throw new Error("Time entry not found");
  const row = await db.timeEntry.update({
    where: { id },
    data: {
      status: "approved",
      approvedAt: new Date(),
      approvedById: ctx.staffMember?.id ?? null,
    },
  });
  revalidateHr(entry.employeeId);
  return row;
}

// ─── Leave types & requests ────────────────────────────────────

export async function createLeaveType(input: {
  name: string;
  isPaid?: boolean;
  defaultAnnualEntitlement?: number;
}) {
  const ctx = await requireHrWrite();
  const row = await db.leaveType.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name.trim(),
      isPaid: input.isPaid ?? true,
      defaultAnnualEntitlement: input.defaultAnnualEntitlement ?? 0,
    },
  });
  revalidateHr();
  return row;
}

export async function listLeaveTypes() {
  const ctx = await requireHrEnabled();
  const role = ctx.staffMember?.role;
  const canHr =
    role &&
    (hasPermission(role, PERMISSIONS.hr.read) ||
      hasPermission(role, PERMISSIONS.hr.write));
  const me = canHr ? null : await getLinkedEmployeeForCurrentUser();
  if (!canHr && !me) throw new Error("FORBIDDEN");
  return db.leaveType.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function submitLeaveRequest(input: {
  employeeId?: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}) {
  const ctx = await requireHrEnabled();
  const me = await getLinkedEmployeeForCurrentUser();
  const canWriteHr =
    ctx.staffMember?.role &&
    hasPermission(ctx.staffMember.role, PERMISSIONS.hr.write);

  let employeeId = input.employeeId;
  if (!employeeId) {
    if (!me) throw new Error("No linked employee record");
    employeeId = me.id;
  } else if (!canWriteHr && me?.id !== employeeId) {
    throw new Error("FORBIDDEN");
  }

  const leaveType = await db.leaveType.findFirst({
    where: tenantWhere(ctx.tenantId, { id: input.leaveTypeId, deletedAt: null }),
  });
  if (!leaveType) throw new Error("Leave type not found");

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const dayCount = inclusiveDayCount(start, end);
  if (dayCount <= 0) throw new Error("Invalid date range");

  const year = start.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const approved = await db.leaveRequest.aggregate({
    where: {
      tenantId: ctx.tenantId,
      employeeId,
      leaveTypeId: leaveType.id,
      status: "approved",
      deletedAt: null,
      startDate: { gte: yearStart, lte: yearEnd },
    },
    _sum: { dayCount: true },
  });
  const used = approved._sum.dayCount ?? 0;
  if (used + dayCount > leaveType.defaultAnnualEntitlement) {
    throw new Error(
      `Insufficient leave balance (used ${used}, requesting ${dayCount}, entitlement ${leaveType.defaultAnnualEntitlement})`,
    );
  }

  const row = await db.leaveRequest.create({
    data: {
      tenantId: ctx.tenantId,
      employeeId,
      leaveTypeId: leaveType.id,
      startDate: start,
      endDate: end,
      dayCount,
      reason: input.reason?.trim() || null,
      status: "pending",
    },
  });
  revalidateHr(employeeId);
  return row;
}

export async function decideLeaveRequest(input: {
  id: string;
  decision: "approved" | "rejected";
}) {
  const ctx = await requireHrWrite();
  const existing = await db.leaveRequest.findFirst({
    where: tenantWhere(ctx.tenantId, { id: input.id, deletedAt: null }),
  });
  if (!existing) throw new Error("Leave request not found");
  if (existing.status !== "pending") throw new Error("Request is not pending");

  if (input.decision === "approved") {
    const leaveType = await db.leaveType.findFirst({
      where: { id: existing.leaveTypeId, tenantId: ctx.tenantId },
    });
    const year = existing.startDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31));
    const approved = await db.leaveRequest.aggregate({
      where: {
        tenantId: ctx.tenantId,
        employeeId: existing.employeeId,
        leaveTypeId: existing.leaveTypeId,
        status: "approved",
        deletedAt: null,
        startDate: { gte: yearStart, lte: yearEnd },
        NOT: { id: existing.id },
      },
      _sum: { dayCount: true },
    });
    const used = approved._sum.dayCount ?? 0;
    const entitlement = leaveType?.defaultAnnualEntitlement ?? 0;
    if (used + existing.dayCount > entitlement) {
      throw new Error("Approving would exceed leave entitlement");
    }
  }

  const row = await db.leaveRequest.update({
    where: { id: existing.id },
    data: {
      status: input.decision,
      approvedAt: new Date(),
      approvedById: ctx.staffMember?.id ?? null,
    },
  });
  revalidateHr(existing.employeeId);
  return row;
}

export async function listPendingLeaveRequests() {
  const ctx = await requireHrRead();
  return db.leaveRequest.findMany({
    where: { tenantId: ctx.tenantId, status: "pending", deletedAt: null },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      leaveType: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getEmployeeLeaveBalances(employeeId: string) {
  await assertCanAccessEmployee(employeeId, "read");
  const ctx = await requireHrEnabled();
  const types = await db.leaveType.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
  });
  const year = new Date().getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));

  const results = [];
  for (const t of types) {
    const [approved, pending] = await Promise.all([
      db.leaveRequest.aggregate({
        where: {
          tenantId: ctx.tenantId,
          employeeId,
          leaveTypeId: t.id,
          status: "approved",
          deletedAt: null,
          startDate: { gte: yearStart, lte: yearEnd },
        },
        _sum: { dayCount: true },
      }),
      db.leaveRequest.aggregate({
        where: {
          tenantId: ctx.tenantId,
          employeeId,
          leaveTypeId: t.id,
          status: "pending",
          deletedAt: null,
          startDate: { gte: yearStart, lte: yearEnd },
        },
        _sum: { dayCount: true },
      }),
    ]);
    results.push(
      computeLeaveBalance({
        leaveTypeId: t.id,
        name: t.name,
        entitlement: t.defaultAnnualEntitlement,
        approvedDayCount: approved._sum.dayCount ?? 0,
        pendingDayCount: pending._sum.dayCount ?? 0,
      }),
    );
  }
  return results;
}
