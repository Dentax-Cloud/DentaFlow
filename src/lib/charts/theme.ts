/** Recharts palette aligned with DentaFlow design tokens (primary / dental sky). */
export const CHART_COLORS = {
  primary: "hsl(199 89% 48%)",
  primaryMuted: "hsl(199 89% 72%)",
  secondary: "hsl(215 16% 47%)",
  success: "hsl(142 71% 45%)",
  warning: "hsl(38 92% 50%)",
  destructive: "hsl(0 84% 60%)",
  muted: "hsl(210 40% 96%)",
  grid: "hsl(214 32% 91%)",
  axis: "hsl(215 16% 47%)",
} as const;

export const CHART_SERIES_PALETTE = [
  CHART_COLORS.primary,
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#14b8a6",
  "#64748b",
] as const;

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(0 0% 100%)",
    border: "1px solid hsl(214 32% 91%)",
    borderRadius: "8px",
    fontSize: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  labelStyle: { color: "hsl(215 16% 47%)", fontWeight: 600 },
} as const;
