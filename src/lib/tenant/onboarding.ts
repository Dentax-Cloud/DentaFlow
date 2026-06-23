import type { Tenant } from "@prisma/client";
import { db } from "@/lib/db";

export type OnboardingChecklistItem = {
  id: string;
  label: string;
  href: string;
  completed: boolean;
};

export type OnboardingChecklistState = {
  items: OnboardingChecklistItem[];
  allComplete: boolean;
  skipped: boolean;
  showChecklist: boolean;
};

const CHECKLIST_ITEM_DEFS = [
  { id: "clinic", label: "Clinic created", href: "/dashboard" },
  { id: "patient", label: "Add your first patient", href: "/patients" },
  { id: "appointment", label: "Schedule first appointment", href: "/appointments" },
  { id: "procedures", label: "Set up procedure catalog", href: "/admin/procedure-catalog" },
  { id: "team", label: "Invite a team member", href: "/admin" },
  { id: "profile", label: "Customize clinic profile", href: "/admin/clinic-profile" },
] as const;

function tenantMetadata(tenant: Tenant): Record<string, unknown> {
  if (!tenant.metadata || typeof tenant.metadata !== "object" || Array.isArray(tenant.metadata)) {
    return {};
  }
  return tenant.metadata as Record<string, unknown>;
}

export function isNewTenant(tenant: Tenant, now = new Date()): boolean {
  const ageMs = now.getTime() - tenant.createdAt.getTime();
  return ageMs < 7 * 24 * 60 * 60 * 1000;
}

export function requiresOnboarding(tenant: Tenant): boolean {
  if (tenant.onboardingCompleted) return false;
  const meta = tenantMetadata(tenant);
  if (meta.onboardingSkipped === true) return false;
  return isNewTenant(tenant);
}

export async function getOnboardingChecklist(tenant: Tenant): Promise<OnboardingChecklistState> {
  const meta = tenantMetadata(tenant);
  const skipped = meta.onboardingSkipped === true;

  if (tenant.onboardingCompleted || skipped) {
    return {
      items: [],
      allComplete: true,
      skipped,
      showChecklist: false,
    };
  }

  if (!isNewTenant(tenant)) {
    return {
      items: [],
      allComplete: true,
      skipped: false,
      showChecklist: false,
    };
  }

  const [patientCount, appointmentCount, procedureCount, staffCount] = await Promise.all([
    db.patient.count({ where: { tenantId: tenant.id, deletedAt: null } }),
    db.appointment.count({ where: { tenantId: tenant.id, deletedAt: null } }),
    db.procedureCatalog.count({ where: { tenantId: tenant.id, isActive: true } }),
    db.staffMember.count({ where: { tenantId: tenant.id, isActive: true, deletedAt: null } }),
  ]);

  const profileComplete = Boolean(tenant.address && tenant.phone && tenant.city);

  const completionById: Record<string, boolean> = {
    clinic: true,
    patient: patientCount > 0,
    appointment: appointmentCount > 0,
    procedures: procedureCount > 0,
    team: staffCount > 1,
    profile: profileComplete,
  };

  const items: OnboardingChecklistItem[] = CHECKLIST_ITEM_DEFS.map((item) => ({
    ...item,
    completed: completionById[item.id] ?? false,
  }));

  const allComplete = items.every((item) => item.completed);

  return {
    items,
    allComplete,
    skipped: false,
    showChecklist: true,
  };
}

export async function markOnboardingComplete(tenantId: string) {
  await db.tenant.update({
    where: { id: tenantId },
    data: { onboardingCompleted: true },
  });
}

export async function skipOnboardingChecklist(tenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  const meta = tenant ? tenantMetadata(tenant) : {};

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      onboardingCompleted: true,
      metadata: {
        ...meta,
        onboardingSkipped: true,
        onboardingSkippedAt: new Date().toISOString(),
      },
    },
  });
}
