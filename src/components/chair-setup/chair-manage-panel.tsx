"use client";

import { useState } from "react";
import type { ChairType } from "@/lib/chair-setup/types";
import {
  CHAIR_TYPE_DEFAULT_COLORS,
  CHAIR_TYPE_LABELS,
  COLOR_PRESETS,
} from "@/lib/chair-setup/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ChairFormData = {
  id?: string;
  name: string;
  number: number;
  roomName: string;
  chairType: ChairType;
  colorCode: string;
  equipment: string[];
  status: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chairs: Array<{
    id: string;
    name: string;
    number: number;
    roomName: string | null;
    chairType: string;
    colorCode: string;
    equipment: string[] | null;
    status: string;
  }>;
  onSave: (data: ChairFormData) => void;
  isPending: boolean;
};

const CHAIR_TYPES = Object.keys(CHAIR_TYPE_LABELS) as ChairType[];

export function ChairManagePanel({
  open,
  onOpenChange,
  chairs,
  onSave,
  isPending,
}: Props) {
  const [selectedId, setSelectedId] = useState(chairs[0]?.id ?? "");
  const selected = chairs.find((c) => c.id === selectedId);

  const [form, setForm] = useState<ChairFormData>(() =>
    selected
      ? {
          id: selected.id,
          name: selected.name,
          number: selected.number,
          roomName: selected.roomName ?? "",
          chairType: selected.chairType as ChairType,
          colorCode: selected.colorCode,
          equipment: (selected.equipment as string[]) ?? [],
          status: selected.status,
        }
      : {
          name: "",
          number: 1,
          roomName: "",
          chairType: "GENERAL",
          colorCode: CHAIR_TYPE_DEFAULT_COLORS.GENERAL,
          equipment: [],
          status: "ACTIVE",
        },
  );

  const [equipmentInput, setEquipmentInput] = useState("");

  function selectChair(chairId: string) {
    setSelectedId(chairId);
    const c = chairs.find((ch) => ch.id === chairId);
    if (!c) return;
    setForm({
      id: c.id,
      name: c.name,
      number: c.number,
      roomName: c.roomName ?? "",
      chairType: c.chairType as ChairType,
      colorCode: c.colorCode,
      equipment: (c.equipment as string[]) ?? [],
      status: c.status,
    });
  }

  function addEquipmentTag() {
    const tag = equipmentInput.trim();
    if (!tag || form.equipment.includes(tag)) return;
    setForm((f) => ({ ...f, equipment: [...f.equipment, tag] }));
    setEquipmentInput("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage chairs</DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          <div>
            <Label>Select chair</Label>
            <Select value={selectedId} onValueChange={selectChair}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chairs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <Label>Number</Label>
            <Input
              type="number"
              min={1}
              value={form.number}
              onChange={(e) =>
                setForm((f) => ({ ...f, number: parseInt(e.target.value, 10) || 1 }))
              }
            />
          </div>

          <div>
            <Label>Room name</Label>
            <Input
              placeholder="Room A, Suite 3..."
              value={form.roomName}
              onChange={(e) => setForm((f) => ({ ...f, roomName: e.target.value }))}
            />
          </div>

          <div>
            <Label>Chair type</Label>
            <Select
              value={form.chairType}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  chairType: v as ChairType,
                  colorCode: CHAIR_TYPE_DEFAULT_COLORS[v as ChairType] ?? f.colorCode,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAIR_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CHAIR_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Color</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 ${
                    form.colorCode === color ? "border-gray-900" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setForm((f) => ({ ...f, colorCode: color }))}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>Equipment tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="CBCT, Surgical Light..."
                value={equipmentInput}
                onChange={(e) => setEquipmentInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEquipmentTag())}
              />
              <Button type="button" variant="outline" onClick={addEquipmentTag}>
                Add
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {form.equipment.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        equipment: f.equipment.filter((t) => t !== tag),
                      }))
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            onClick={() => onSave(form)}
            disabled={isPending || !form.name}
          >
            Save chair
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
