import type {
  ChairDisplayStatus,
  ChairType,
  SetupItem,
  TrayItemCategory,
  TrayTemplateItem,
} from "./types";
import { CATEGORY_CONFIG } from "./constants";

export function inferTrayCategory(invCategory: string | null | undefined): TrayItemCategory {
  if (!invCategory) return "CONSUMABLE";
  const lower = invCategory.toLowerCase();
  if (lower.includes("med") || lower.includes("drug") || lower.includes("pharm")) {
    return "MEDICATION";
  }
  if (lower.includes("material") || lower.includes("composite") || lower.includes("cement")) {
    return "MATERIAL";
  }
  if (lower.includes("equip") || lower.includes("instrument") || lower.includes("device")) {
    return "EQUIPMENT";
  }
  return "CONSUMABLE";
}

export function normalizeTrayItem(
  item: Partial<TrayTemplateItem> & Pick<TrayTemplateItem, "inventoryItemId" | "itemName" | "qty" | "unit">,
): TrayTemplateItem {
  return {
    ...item,
    category: item.category ?? "CONSUMABLE",
    costPrice: item.costPrice,
  };
}

export function getChairStatus(input: {
  chairStatus: string;
  sessionStatus: string | null;
  setup: { status: string } | null;
  hasActivePatient: boolean;
  hasLowStock?: boolean;
}): ChairDisplayStatus {
  if (input.chairStatus !== "ACTIVE") return "INACTIVE";
  if (!input.sessionStatus || input.sessionStatus !== "OPEN") return "INACTIVE";
  if (!input.setup) return "NOT_SETUP";
  if (input.setup.status === "PENDING") return "SETTING_UP";
  if (input.setup.status === "CLOSED") return "CLOSED";
  if (input.hasLowStock) return "ALERT";
  if (input.setup.status === "ACTIVE") {
    return input.hasActivePatient ? "IN_USE" : "READY";
  }
  return "SETTING_UP";
}

export function groupByCategory<T extends { category?: TrayItemCategory }>(
  items: T[],
): Record<TrayItemCategory, T[]> {
  const groups: Record<TrayItemCategory, T[]> = {
    CONSUMABLE: [],
    MEDICATION: [],
    MATERIAL: [],
    EQUIPMENT: [],
  };
  for (const item of items) {
    const cat = item.category ?? "CONSUMABLE";
    groups[cat].push(item);
  }
  return groups;
}

export function getConsumedQty(
  inventoryItemId: string,
  consumedItems: SetupItem[],
): number {
  return consumedItems
    .filter((c) => c.inventoryItemId === inventoryItemId)
    .reduce((s, c) => s + c.qty, 0);
}

export function getReturnedQty(
  inventoryItemId: string,
  returnedItems: Array<{ inventoryItemId: string; qty: number }>,
): number {
  return returnedItems
    .filter((r) => r.inventoryItemId === inventoryItemId)
    .reduce((s, r) => s + r.qty, 0);
}

export function getRemainingQty(
  item: SetupItem,
  consumedItems: SetupItem[],
  returnedItems: Array<{ inventoryItemId: string; qty: number }>,
): number {
  if (item.category === "EQUIPMENT") return item.qty;
  return (
    item.qty -
    getConsumedQty(item.inventoryItemId, consumedItems) -
    getReturnedQty(item.inventoryItemId, returnedItems)
  );
}

export type CategorySummary = {
  key: TrayItemCategory;
  icon: string;
  label: string;
  setup: number;
  remaining: number;
  hasLowStock: boolean;
};

export function buildCategorySummaries(
  setupItems: SetupItem[],
  consumedItems: SetupItem[],
  returnedItems: Array<{ inventoryItemId: string; qty: number }>,
): CategorySummary[] {
  const groups = groupByCategory(setupItems);
  return (Object.keys(groups) as TrayItemCategory[])
    .filter((key) => groups[key].length > 0)
    .map((key) => {
      const items = groups[key];
      const setup = items.reduce((s, i) => s + i.qty, 0);
      const remaining = items.reduce(
        (s, i) => s + getRemainingQty(i, consumedItems, returnedItems),
        0,
      );
      const hasLowStock =
        key !== "EQUIPMENT" &&
        items.some((i) => getRemainingQty(i, consumedItems, returnedItems) <= 1);
      return {
        key,
        icon: CATEGORY_CONFIG[key].icon,
        label: CATEGORY_CONFIG[key].label,
        setup,
        remaining,
        hasLowStock,
      };
    });
}

export function canOpenDay(role: string) {
  return ["OWNER", "ADMIN", "RECEPTIONIST"].includes(role);
}

export function canCloseDay(role: string) {
  return ["OWNER", "ADMIN", "RECEPTIONIST"].includes(role);
}

export function canSetupTray(role: string) {
  return ["OWNER", "ADMIN", "RECEPTIONIST", "NURSE"].includes(role);
}

export function canManageChairs(role: string) {
  return ["OWNER", "ADMIN"].includes(role);
}

export function canAssignDoctor(role: string) {
  return ["OWNER", "ADMIN", "RECEPTIONIST"].includes(role);
}

export function canManageTemplates(role: string) {
  return ["OWNER", "ADMIN", "RECEPTIONIST", "NURSE"].includes(role);
}

export function isDoctorRole(role: string) {
  return ["DOCTOR", "DENTIST", "HYGIENIST"].includes(role);
}

export function isStoreRole(role: string) {
  return role === "STORE";
}

export function defaultColorForType(chairType: string): string {
  const map: Record<string, string> = {
    GENERAL: "#0ea5e9",
    SPECIALIST: "#8b5cf6",
    PAEDIATRIC: "#f59e0b",
    HYGIENE: "#10b981",
    ORAL_SURGERY: "#ef4444",
  };
  return map[chairType] ?? "#0ea5e9";
}

export function parseChairType(value: string): ChairType {
  const valid: ChairType[] = [
    "GENERAL",
    "SPECIALIST",
    "PAEDIATRIC",
    "HYGIENE",
    "ORAL_SURGERY",
  ];
  return valid.includes(value as ChairType) ? (value as ChairType) : "GENERAL";
}