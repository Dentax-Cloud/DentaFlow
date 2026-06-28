import type { ChairDisplayStatus, ChairType, TrayItemCategory } from "./types";

export const CHAIR_TYPE_ICONS: Record<ChairType, string> = {
  GENERAL: "🪑",
  SPECIALIST: "🦷",
  PAEDIATRIC: "🧒",
  HYGIENE: "✨",
  ORAL_SURGERY: "🔩",
};

export const CHAIR_TYPE_LABELS: Record<ChairType, string> = {
  GENERAL: "General Purpose",
  SPECIALIST: "Specialist",
  PAEDIATRIC: "Paediatric",
  HYGIENE: "Hygiene",
  ORAL_SURGERY: "Oral Surgery",
};

export const CHAIR_TYPE_DEFAULT_COLORS: Record<ChairType, string> = {
  GENERAL: "#0ea5e9",
  SPECIALIST: "#8b5cf6",
  PAEDIATRIC: "#f59e0b",
  HYGIENE: "#10b981",
  ORAL_SURGERY: "#ef4444",
};

export const COLOR_PRESETS = [
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#f97316",
  "#06b6d4",
  "#64748b",
];

export const STATUS_CONFIG: Record<
  ChairDisplayStatus,
  { label: string; dot: string; bg: string }
> = {
  INACTIVE: { label: "Inactive", dot: "⚫", bg: "bg-gray-100 text-gray-500" },
  NOT_SETUP: { label: "Not set up", dot: "🟡", bg: "bg-yellow-100 text-yellow-700" },
  SETTING_UP: { label: "Setting up", dot: "🟡", bg: "bg-yellow-100 text-yellow-700" },
  READY: { label: "Ready", dot: "🟢", bg: "bg-green-100 text-green-700" },
  IN_USE: { label: "In use", dot: "🔵", bg: "bg-blue-100 text-blue-700" },
  CLOSED: { label: "Closed", dot: "⚫", bg: "bg-gray-100 text-gray-500" },
  ALERT: { label: "Alert", dot: "🔴", bg: "bg-red-100 text-red-700" },
};

export const CATEGORY_CONFIG: Record<
  TrayItemCategory,
  { icon: string; label: string; bg: string; border: string; pill: string }
> = {
  CONSUMABLE: {
    icon: "🧤",
    label: "Consumables",
    bg: "bg-blue-50",
    border: "border-blue-200",
    pill: "bg-blue-100 text-blue-700",
  },
  MEDICATION: {
    icon: "💊",
    label: "Medications",
    bg: "bg-purple-50",
    border: "border-purple-200",
    pill: "bg-purple-100 text-purple-700",
  },
  MATERIAL: {
    icon: "🧪",
    label: "Materials",
    bg: "bg-orange-50",
    border: "border-orange-200",
    pill: "bg-orange-100 text-orange-700",
  },
  EQUIPMENT: {
    icon: "🔧",
    label: "Equipment",
    bg: "bg-gray-50",
    border: "border-gray-200",
    pill: "bg-gray-100 text-gray-700",
  },
};

export const TRAY_CATEGORIES: TrayItemCategory[] = [
  "CONSUMABLE",
  "MEDICATION",
  "MATERIAL",
  "EQUIPMENT",
];
