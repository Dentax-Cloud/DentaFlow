"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createPatient } from "@/app/(dashboard)/features/patients/actions";
import { createPatientSchema, type CreatePatientInput } from "@/app/(dashboard)/features/patients/schemas";
import type { Patient } from "@prisma/client";
import { Plus, Search, Users } from "lucide-react";

export function PatientsClient({ initialPatients }: { initialPatients: Patient[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<CreatePatientInput>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: { firstName: "", lastName: "", allergies: [] },
  });

  const filtered = initialPatients.filter((p) => {
    const q = search.toLowerCase();
    return (
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.patientNumber.toLowerCase().includes(q) ||
      (p.patientId?.toLowerCase().includes(q) ?? false)
    );
  });

  async function onSubmit(data: CreatePatientInput) {
    setLoading(true);
    const result = await createPatient(data);
    setLoading(false);
    if (result.success) {
      toast.success("Patient created");
      setShowForm(false);
      form.reset();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Patients</h1>
          <p className="text-muted-foreground">{initialPatients.length} registered</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          Add patient
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New patient</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>First name</Label>
                <Input {...form.register("firstName")} />
                {form.formState.errors.firstName && (
                  <p className="mt-1 text-xs text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Last name</Label>
                <Input {...form.register("lastName")} />
                {form.formState.errors.lastName && (
                  <p className="mt-1 text-xs text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" {...form.register("email")} />
                {form.formState.errors.email && (
                  <p className="mt-1 text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Phone</Label>
                <Input {...form.register("phone")} />
              </div>
              <Button type="submit" disabled={loading} className="sm:col-span-2">
                {loading ? "Saving..." : "Save patient"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search patients..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-3">
        {filtered.map((patient) => (
          <Link key={patient.id} href={`/patients/${patient.id}`}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {patient.patientId ?? patient.patientNumber}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {patient.churnRisk && (
                    <Badge variant={patient.churnRisk === "HIGH" ? "destructive" : "warning"}>
                      Churn {patient.churnRisk}
                    </Badge>
                  )}
                  {patient.phone && (
                    <span className="text-sm text-muted-foreground">{patient.phone}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No patients found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try a different search term" : "Add your first patient to get started"}
              </p>
            </div>
            {!search && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add first patient
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
