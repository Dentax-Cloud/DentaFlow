"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createPatientDynamic } from "@/app/(dashboard)/features/patients/actions";
import { DynamicPatientForm } from "@/components/patients/dynamic-patient-form";
import type { PatientFormField } from "@/lib/countries/patient-form-config";
import type { Patient } from "@prisma/client";
import { Plus, Search, Users } from "lucide-react";

type Props = {
  initialPatients: Patient[];
  formFields: PatientFormField[];
  countryCode: string;
};

export function PatientsClient({ initialPatients, formFields, countryCode }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const filtered = initialPatients.filter((p) => {
    const q = search.toLowerCase();
    return (
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.patientNumber.toLowerCase().includes(q) ||
      (p.patientId?.toLowerCase().includes(q) ?? false)
    );
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await createPatientDynamic({ values: formValues });
    setLoading(false);
    if (result.success) {
      toast.success("Patient created");
      setShowForm(false);
      setFormValues({});
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
            <form onSubmit={onSubmit} className="space-y-4">
              <DynamicPatientForm
                fields={formFields}
                countryCode={countryCode}
                initialValues={formValues}
                onChange={setFormValues}
              />
              <Button type="submit" disabled={loading}>
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
          <Link
            key={patient.id}
            href={`/patients/${patient.id}`}
            className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {patient.firstName} {patient.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {patient.patientNumber}
                  {patient.patientId ? ` · ${patient.patientId}` : ""}
                </p>
              </div>
            </div>
            {patient.phone && <Badge variant="outline">{patient.phone}</Badge>}
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">No patients found</p>
        )}
      </div>
    </div>
  );
}
