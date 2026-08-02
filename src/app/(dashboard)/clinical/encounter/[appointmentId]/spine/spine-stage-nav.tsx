"use client";

import {
  Activity,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Scan,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SpineNavPanelId =
  | "intake"
  | "exam"
  | "gates"
  | "findings"
  | "procedures"
  | "close_out"
  | "billing";

export type SpineToolId =
  | "odontogram"
  | "perio"
  | "radiographs"
  | "photos"
  | "treatment_plan";

const STAGE_ORDER: SpineNavPanelId[] = [
  "intake",
  "exam",
  "gates",
  "findings",
  "procedures",
  "close_out",
  "billing",
];

const STAGE_LABELS: Record<SpineNavPanelId, string> = {
  intake: "Intake",
  exam: "Exam",
  gates: "Gates",
  findings: "Findings",
  procedures: "Procedures",
  close_out: "Close-out",
  billing: "Billing",
};

const TOOLS: Array<{ id: SpineToolId; label: string; icon: typeof Smile }> = [
  { id: "odontogram", label: "Odontogram", icon: Smile },
  { id: "perio", label: "Perio", icon: Activity },
  { id: "radiographs", label: "Radiographs", icon: Scan },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "treatment_plan", label: "Treatment plan", icon: ClipboardList },
];

/** Map encounter status → primary nav stage (findings is UI-only between gates and procedures). */
export function statusToNavStage(status: string): SpineNavPanelId {
  switch (status) {
    case "arrival_intake":
      return "intake";
    case "chief_complaint_exam":
      return "exam";
    case "gates":
      return "gates";
    case "procedure_execution":
      return "procedures";
    case "close_out":
      return "close_out";
    case "billing":
    case "recall_scheduled":
      return "billing";
    default:
      return "intake";
  }
}

function stageProgress(
  status: string,
  panelId: SpineNavPanelId,
): "current" | "completed" | "upcoming" {
  const current = statusToNavStage(status);
  const currentIdx = STAGE_ORDER.indexOf(current);
  const panelIdx = STAGE_ORDER.indexOf(panelId);

  // Findings is a nav target between gates and procedures — treat relative to encounter stage.
  if (panelId === "findings") {
    if (current === "gates") return "upcoming";
    if (currentIdx >= STAGE_ORDER.indexOf("procedures")) return "completed";
    return "upcoming";
  }

  if (panelIdx < currentIdx) return "completed";
  if (panelIdx === currentIdx) return "current";
  return "upcoming";
}

export function SpineStageNav({
  currentStatus,
  activePanel,
  onSelectPanel,
  collapsed,
  onToggleCollapsed,
  onOpenTool,
}: {
  currentStatus: string;
  activePanel: string;
  onSelectPanel: (id: SpineNavPanelId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenTool: (tool: SpineToolId) => void;
}) {
  return (
    <nav
      aria-label="Encounter stages"
      className={cn(
        "flex h-full flex-col border-r border-slate-200 bg-slate-50/80 transition-[width]",
        collapsed ? "w-14" : "w-52",
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-slate-200 p-2",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <span className="px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
            Stages
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200/60"
          aria-label={collapsed ? "Expand stage navigation" : "Collapse stage navigation"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <ul className="flex flex-1 flex-col gap-1 p-2">
        {STAGE_ORDER.map((id) => {
          const progress = stageProgress(currentStatus, id);
          const isActive = activePanel === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelectPanel(id)}
                aria-current={isActive ? "page" : undefined}
                title={STAGE_LABELS[id]}
                className={cn(
                  "flex w-full min-h-10 items-center gap-2 rounded-md px-2 text-left text-sm transition",
                  collapsed && "justify-center px-0",
                  isActive && "bg-teal-50 text-teal-900 ring-1 ring-inset ring-teal-200",
                  !isActive && progress === "current" && "text-teal-800",
                  !isActive && progress === "completed" && "text-slate-500",
                  !isActive && progress === "upcoming" && "text-slate-400",
                  !isActive && "hover:bg-slate-100",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                    progress === "current" && "bg-teal-700 text-white",
                    progress === "completed" && "bg-slate-200 text-slate-600",
                    progress === "upcoming" && "bg-slate-100 text-slate-400",
                  )}
                >
                  {progress === "completed" ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : (
                    STAGE_ORDER.indexOf(id) + 1
                  )}
                </span>
                {!collapsed && <span className="truncate font-medium">{STAGE_LABELS[id]}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-slate-200 p-2">
        {!collapsed && (
          <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
            Tools
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onOpenTool(id)}
                title={label}
                className={cn(
                  "flex w-full min-h-10 min-w-10 items-center gap-2 rounded-md px-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {!collapsed && <span className="truncate">{label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
