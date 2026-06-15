"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { createAppointment } from "@/app/(dashboard)/features/appointments/actions";
import type { Chair, Doctor, Patient, User } from "@prisma/client";

type DoctorWithUser = Doctor & { user: User };
type ChairWithDoctor = Chair & { doctor: DoctorWithUser | null };

type Props = {
  patients: Patient[];
  doctors: DoctorWithUser[];
  chairs: ChairWithDoctor[];
  defaultStart?: Date;
  defaultEnd?: Date;
  defaultPatientId?: string;
  onCreated?: () => void;
};

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function BookAppointmentDialog({
  patients,
  doctors,
  chairs,
  defaultStart,
  defaultEnd,
  defaultPatientId,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const startDefault = defaultStart ?? new Date();
  const endDefault = defaultEnd ?? new Date(startDefault.getTime() + 30 * 60 * 1000);

  const [patientId, setPatientId] = useState(defaultPatientId ?? "");
  const [doctorId, setDoctorId] = useState("");
  const [chairId, setChairId] = useState("");
  const [title, setTitle] = useState("Consultation");
  const [type, setType] = useState("checkup");
  const [startTime, setStartTime] = useState(toLocalInputValue(startDefault));
  const [endTime, setEndTime] = useState(toLocalInputValue(endDefault));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (defaultPatientId) setPatientId(defaultPatientId);
    if (defaultStart) setStartTime(toLocalInputValue(defaultStart));
    if (defaultEnd) setEndTime(toLocalInputValue(defaultEnd));
  }, [defaultPatientId, defaultStart, defaultEnd, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) {
      toast.error("Select a patient");
      return;
    }

    setLoading(true);
    const result = await createAppointment({
      patientId,
      title,
      type,
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

    toast.success("Appointment booked");
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New appointment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book appointment</DialogTitle>
          <DialogDescription>
            {defaultStart
              ? `Slot: ${format(defaultStart, "EEE, MMM d · h:mm a")}`
              : "Schedule a new visit with chair and provider assignment."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patientId">Patient</Label>
            <select
              id="patientId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
            >
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} ({p.patientNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doctorId">Doctor</Label>
              <select
                id="doctorId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.user.firstName} {d.user.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chairId">Operatory</Label>
              <select
                id="chairId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={chairId}
                onChange={(e) => setChairId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {chairs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Input id="type" value={type} onChange={(e) => setType(e.target.value)} placeholder="checkup, cleaning…" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Book appointment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
