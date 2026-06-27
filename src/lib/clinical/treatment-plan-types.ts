export type Priority = "URGENT" | "HIGH" | "ELECTIVE" | "COSMETIC";
export type PlanStatus =
  | "DRAFT"
  | "PROPOSED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DECLINED";
export type ItemStatus = "PENDING" | "SCHEDULED" | "COMPLETED" | "DECLINED";

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; bgColor: string; order: number }
> = {
  URGENT: { label: "Urgent", color: "text-red-700", bgColor: "bg-red-100", order: 1 },
  HIGH: { label: "High", color: "text-orange-700", bgColor: "bg-orange-100", order: 2 },
  ELECTIVE: { label: "Elective", color: "text-blue-700", bgColor: "bg-blue-100", order: 3 },
  COSMETIC: { label: "Cosmetic", color: "text-purple-700", bgColor: "bg-purple-100", order: 4 },
};

export const STATUS_CONFIG: Record<
  PlanStatus,
  { label: string; color: string; nextActions: string[] }
> = {
  DRAFT: {
    label: "Draft",
    color: "bg-gray-100 text-gray-700",
    nextActions: ["propose", "delete"],
  },
  PROPOSED: {
    label: "Proposed",
    color: "bg-blue-100 text-blue-700",
    nextActions: ["accept", "decline"],
  },
  ACCEPTED: {
    label: "Accepted",
    color: "bg-green-100 text-green-700",
    nextActions: ["start", "complete"],
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "bg-yellow-100 text-yellow-700",
    nextActions: ["complete"],
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-emerald-100 text-emerald-700",
    nextActions: ["revise"],
  },
  DECLINED: {
    label: "Declined",
    color: "bg-red-100 text-red-700",
    nextActions: ["revise"],
  },
};

export function normalizeItemStatus(status: string): ItemStatus {
  const upper = status.toUpperCase();
  if (upper === "SCHEDULED" || upper === "COMPLETED" || upper === "DECLINED") {
    return upper as ItemStatus;
  }
  return "PENDING";
}

export function getVisitNumber(item: { visitNumber?: number | null; phase?: number | null }) {
  return item.visitNumber ?? item.phase ?? 1;
}

export function getItemCost(item: { totalCost?: unknown }) {
  return Number(item.totalCost ?? 0);
}

export function mapItemForTotals(item: {
  totalCost?: unknown;
  status?: string;
  visitNumber?: number | null;
  phase?: number | null;
}) {
  return {
    estimatedCost: getItemCost(item),
    status: normalizeItemStatus(item.status ?? "PENDING"),
    visitNumber: getVisitNumber(item),
  };
}

export function calculatePlanTotals(
  items: Array<{
    totalCost?: unknown;
    estimatedCost?: number;
    status?: string;
    visitNumber?: number | null;
    phase?: number | null;
  }>,
) {
  const mapped = items.map((i) =>
    i.estimatedCost != null
      ? {
          estimatedCost: i.estimatedCost,
          status: normalizeItemStatus(i.status ?? "PENDING"),
          visitNumber: getVisitNumber(i),
        }
      : mapItemForTotals(i),
  );

  const total = mapped.reduce((sum, i) => sum + i.estimatedCost, 0);
  const pending = mapped
    .filter((i) => i.status === "PENDING" || i.status === "SCHEDULED")
    .reduce((sum, i) => sum + i.estimatedCost, 0);
  const completed = mapped
    .filter((i) => i.status === "COMPLETED")
    .reduce((sum, i) => sum + i.estimatedCost, 0);
  const visits = [...new Set(mapped.map((i) => i.visitNumber))].length;

  return { total, pending, completed, visits };
}

export function formatToothNumbers(toothNumbers: string[] | string | null | undefined) {
  if (!toothNumbers) return "";
  if (Array.isArray(toothNumbers)) return toothNumbers.join(", ");
  return toothNumbers;
}

export function mapPlanItemForClient(item: {
  id: string;
  description: string;
  totalCost?: unknown;
  status: string;
  visitNumber?: number | null;
  phase?: number | null;
  priority?: string | null;
  toothNumbers?: string[];
  surfaces?: string | null;
  estimatedDuration?: number | null;
  linkedAppointmentId?: string | null;
}) {
  return {
    id: item.id,
    description: item.description,
    estimatedCost: getItemCost(item),
    status: normalizeItemStatus(item.status),
    visitNumber: getVisitNumber(item),
    priority: (item.priority ?? "ELECTIVE") as Priority,
    toothNumbers: formatToothNumbers(item.toothNumbers),
    surfaces: item.surfaces ?? null,
    estimatedDuration: item.estimatedDuration ?? null,
    linkedAppointmentId: item.linkedAppointmentId ?? null,
  };
}
