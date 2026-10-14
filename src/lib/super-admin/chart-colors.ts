import { TenantStatus } from "@prisma/client";
import { SUBSCRIPTION_PLAN_VALUES, type SubscriptionPlan } from "@/lib/subscription/plan-types";

/**
 * Chart color tokens for the superadmin analytics dashboard.
 *
 * Categorical (plan) colors are the `dataviz` skill's validated dark-surface
 * palette, slots 1-3, in fixed order — assigned by entity (plan), never by
 * current rank, so filtering never repaints survivors. Status colors reuse
 * the exact hexes behind `TenantStatusBadge`'s success/warning/destructive
 * variants, so a tenant's color means the same thing in the table and in the
 * charts. CLOSED has no status-palette equivalent (it isn't good/warn/bad,
 * just inactive), so it gets a neutral zinc gray instead of a 4th status hue.
 */

export const PLAN_ORDER: readonly SubscriptionPlan[] = SUBSCRIPTION_PLAN_VALUES;

export const PLAN_COLORS: Record<SubscriptionPlan, string> = {
  STARTER: "#3987e5", // categorical slot 1 — blue
  PROFESSIONAL: "#d95926", // categorical slot 2 — orange
  ENTERPRISE: "#199e70", // categorical slot 3 — aqua
};

export const STATUS_ORDER: readonly TenantStatus[] = [
  TenantStatus.ACTIVE,
  TenantStatus.PENDING,
  TenantStatus.SUSPENDED,
  TenantStatus.CLOSED,
];

export const STATUS_COLORS: Record<TenantStatus, string> = {
  ACTIVE: "#0ca30c", // status: good
  PENDING: "#fab219", // status: warning
  SUSPENDED: "#d03b3b", // status: critical
  CLOSED: "#71717a", // neutral (zinc-500) — not a status-palette hue, just "inactive"
};

/** Single-hue sequential blue (step 400) for magnitude/trend charts with one series. */
export const SEQUENTIAL_BLUE = "#3987e5";

/** Chart chrome, tuned to this app's existing dark zinc chrome rather than the skill's own surface. */
export const CHART_GRID = "rgba(255,255,255,0.08)";
export const CHART_AXIS_TEXT = "#a1a1aa"; // zinc-400, matches existing muted text
export const CHART_TOOLTIP_BG = "#18181b"; // zinc-900
export const CHART_TOOLTIP_BORDER = "rgba(255,255,255,0.1)";
