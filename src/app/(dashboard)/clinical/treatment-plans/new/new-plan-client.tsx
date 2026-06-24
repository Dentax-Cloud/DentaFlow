"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTreatmentPlanRecord } from "@/app/(dashboard)/features/clinical/treatment-plan-actions";

type Props = {
  patients: { id: string; firstName: string; lastName: string }[];
  procedures: { id: string; code: string; name: string; price: number; duration: number | null }[];
  defaultPatientId: string | null;
};

export default function NewPlanClient({ patients, procedures, defaultPatientId }: Props) {
  const router = useRouter();
  const [patientId, setPatientId] = useState(defaultPatientId ?? "");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId || !title.trim()) {
      toast.error("Patient and title are required");
      return;
    }
    startTransition(async () => {
      try {
        const plan = await createTreatmentPlanRecord({
          patientId,
          title: title.trim(),
          notes: notes.trim() || undefined,
        });
        toast.success("Treatment plan created");
        router.push(`/clinical/treatment-plans/${plan.id}`);
      } catch {
        toast.error("Could not create plan");
      }
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/clinical/treatment-plans">← All plans</Link>
        </Button>
        <h1 className="text-2xl font-bold">New treatment plan</h1>
        <p className="text-sm text-muted-foreground">
          Create a draft plan — add procedures on the detail page
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="patient">Patient *</Label>
              <select
                id="patient"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Select patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Full mouth rehabilitation"
                required
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Clinical notes for this plan..."
              />
            </div>
            {procedures.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {procedures.length} procedures available in catalog — add items after creating the
                plan.
              </p>
            )}
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Creating..." : "Create plan"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
