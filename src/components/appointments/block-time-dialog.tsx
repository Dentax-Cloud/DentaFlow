"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createBlockTime } from "@/app/(dashboard)/features/appointments/actions";
import type { Chair, Doctor, StaffMember } from "@prisma/client";

type DoctorWithUser = Doctor & { user: StaffMember };
type ChairWithDoctor = Chair & { doctor: DoctorWithUser | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: DoctorWithUser[];
  chairs: ChairWithDoctor[];
  defaultStart?: Date;
  defaultEnd?: Date;
  onCreated?: () => void;
};

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function BlockTimeDialog({
  open,
  onOpenChange,
  doctors,
  chairs,
  defaultStart,
  defaultEnd,
  onCreated,
}: Props) {
  const [loading, setLoading] = useState(false);

  const startDefault = defaultStart ?? new Date();
  const endDefault = defaultEnd ?? new Date(startDefault.getTime() + 30 * 60 * 1000);

  const [title, setTitle] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [chairId, setChairId] = useState("");
  const [startTime, setStartTime] = useState(toLocalInputValue(startDefault));
  const [endTime, setEndTime] = useState(toLocalInputValue(endDefault));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (defaultStart) setStartTime(toLocalInputValue(defaultStart));
    if (defaultEnd) setEndTime(toLocalInputValue(defaultEnd));
  }, [open, defaultStart, defaultEnd]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Enter a reason for this block");
      return;
    }

    setLoading(true);
    const result = await createBlockTime({
      title: title.trim(),
      notes: notes || undefined,
      doctorId: doctorId || undefined,
      chairId: chairId || undefined,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    });
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Time blocked");
    setTitle("");
    setDoctorId("");
    setChairId("");
    setNotes("");
    onOpenChange(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Block time</DialogTitle>
          <DialogDescription>
            {defaultStart
              ? `Slot: ${format(defaultStart, "EEE, MMM d · h:mm a")}`
              : "Reserve time on the schedule — not a patient appointment."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="blockTitle">Reason</Label>
            <Input
              id="blockTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lunch, staff meeting, doctor unavailable…"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="blockStart">Start</Label>
              <Input
                id="blockStart"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockEnd">End</Label>
              <Input
                id="blockEnd"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="blockDoctorId">Doctor (optional)</Label>
              <select
                id="blockDoctorId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                <option value="">None</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.user.firstName} {d.user.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockChairId">Chair (optional)</Label>
              <select
                id="blockChairId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={chairId}
                onChange={(e) => setChairId(e.target.value)}
              >
                <option value="">None</option>
                {chairs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blockNotes">Notes</Label>
            <Textarea
              id="blockNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Block time
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
