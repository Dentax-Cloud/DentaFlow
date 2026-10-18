"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ChairDisplayStatus, ChairType, SetupItem } from "@/lib/chair-setup/types";
import {
  CATEGORY_CONFIG,
  CHAIR_TYPE_ICONS,
  TRAY_CATEGORIES,
} from "@/lib/chair-setup/constants";
import {
  canSetupTray,
  getConsumedQty,
  getRemainingQty,
  getReturnedQty,
} from "@/lib/chair-setup/helpers";
import { StatusBadge } from "./status-badge";
import { Button } from "@/components/ui/button";

type ChairRow = {
  id: string;
  name: string;
  chairType: string;
  colorCode: string;
};

type SetupRow = {
  id: string;
  chairId: string;
  setupItems: SetupItem[];
  consumedItems: SetupItem[];
  returnedItems: Array<{ inventoryItemId: string; qty: number }>;
  setupCost: number;
  status: string;
  setupByName?: string | null;
  createdAt?: string;
};

type Props = {
  chairs: ChairRow[];
  setups: Map<string, SetupRow>;
  chairStatuses: Map<string, ChairDisplayStatus>;
  assignedDoctors: Map<string, string>;
  doctorNames: Map<string, string>;
  sessionOpen: boolean;
  currency: string;
  userRole: string;
  onSetup: (chairId: string) => void;
  onReturn: (chairId: string, setupId: string) => void;
};

export function TraySetupAccordion({
  chairs,
  setups,
  chairStatuses,
  assignedDoctors,
  doctorNames,
  sessionOpen,
  currency,
  userRole,
  onSetup,
  onReturn,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleChair(chairId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(chairId)) next.delete(chairId);
      else next.add(chairId);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {chairs.map((chair) => {
        const setup = setups.get(chair.id);
        const isExpanded = expanded.has(chair.id);
        const chairStatus = chairStatuses.get(chair.id) ?? "NOT_SETUP";
        const doctorId = assignedDoctors.get(chair.id);
        const doctorName = doctorId ? doctorNames.get(doctorId) : null;
        const chairType = chair.chairType as ChairType;

        return (
          <div key={chair.id} className="mb-4 overflow-hidden rounded-xl border">
            <div
              className="flex cursor-pointer items-center justify-between px-5 py-4 hover:bg-gray-50"
              onClick={() => toggleChair(chair.id)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: chair.colorCode }}
                />
                <div>
                  <p className="font-semibold">
                    {CHAIR_TYPE_ICONS[chairType]} {chair.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doctorName ?? "No doctor assigned"} ·{" "}
                    {setup ? `${setup.setupItems.length} items` : "Not set up"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={chairStatus} />
                {!setup && sessionOpen && canSetupTray(userRole) && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetup(chair.id);
                    }}
                  >
                    Set up tray
                  </Button>
                )}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </div>
            </div>

            {isExpanded && setup && (
              <div className="border-t">
                {TRAY_CATEGORIES.map((cat) => {
                  const catItems = setup.setupItems.filter((i) => (i.category ?? "CONSUMABLE") === cat);
                  if (!catItems.length) return null;
                  const config = CATEGORY_CONFIG[cat];

                  return (
                    <div
                      key={cat}
                      className={`border-b ${config.bg} ${config.border}`}
                    >
                      <div className="px-5 py-2">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {config.icon} {config.label}
                          {cat === "EQUIPMENT" && (
                            <span className="ml-2 font-normal normal-case text-gray-400">
                              (not consumed)
                            </span>
                          )}
                        </p>
                        <div className="space-y-2">
                          {catItems.map((item) => {
                            const consumed = getConsumedQty(
                              item.inventoryItemId,
                              setup.consumedItems,
                            );
                            const returned = getReturnedQty(
                              item.inventoryItemId,
                              setup.returnedItems,
                            );
                            const remaining = getRemainingQty(
                              item,
                              setup.consumedItems,
                              setup.returnedItems,
                            );
                            const isLow = remaining <= 1 && cat !== "EQUIPMENT";

                            return (
                              <div
                                key={item.inventoryItemId}
                                className="flex items-center justify-between py-1 text-sm"
                              >
                                <span className={isLow ? "font-medium text-red-600" : ""}>
                                  {isLow && "⚠ "}
                                  {item.itemName}
                                </span>
                                {cat === "EQUIPMENT" ? (
                                  <span className="text-xs font-medium text-green-600">
                                    ✓ Present
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-3 text-xs">
                                    <span className="text-muted-foreground">
                                      Setup: {item.qty} {item.unit}
                                    </span>
                                    <span className="text-orange-600">Used: {consumed}</span>
                                    <span
                                      className={`font-semibold ${
                                        isLow ? "text-red-600" : "text-green-600"
                                      }`}
                                    >
                                      Rem: {remaining}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between bg-white px-5 py-3 text-sm">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground">
                      Setup cost:{" "}
                      <strong>
                        {currency} {Number(setup.setupCost).toFixed(2)}
                      </strong>
                    </span>
                    {(setup.setupByName || setup.createdAt) && (
                      <p className="text-xs text-muted-foreground">
                        {setup.setupByName ? `Set up by ${setup.setupByName}` : "Set up"}
                        {setup.createdAt &&
                          ` at ${new Date(setup.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`}
                      </p>
                    )}
                  </div>
                  {sessionOpen && canSetupTray(userRole) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-orange-200 text-orange-600 hover:text-orange-800"
                      onClick={() => onReturn(chair.id, setup.id)}
                    >
                      Return unused items
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
