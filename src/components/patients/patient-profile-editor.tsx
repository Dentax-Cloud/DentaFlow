"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DynamicPatientForm } from "@/components/patients/dynamic-patient-form";
import { PhotoCapture } from "@/components/profile/photo-capture";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updatePatientDynamic } from "@/app/(dashboard)/features/patients/actions";
import type { PatientFormField } from "@/lib/countries/patient-form-config";

type Props = {
  patientId: string;
  formFields: PatientFormField[];
  countryCode: string;
  initialValues: Record<string, string>;
  photoUrl?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  uploadsEnabled: boolean;
  showUploadConfigHint?: boolean;
  onCancel: () => void;
  onSaved?: () => void;
};

export function PatientProfileEditor({
  patientId,
  formFields,
  countryCode,
  initialValues,
  photoUrl,
  firstName,
  lastName,
  email,
  uploadsEnabled,
  showUploadConfigHint = false,
  onCancel,
  onSaved,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [loading, setLoading] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(photoUrl);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await updatePatientDynamic({ id: patientId, values });
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Patient updated");
    onSaved?.();
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edit profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <PhotoCapture
          entityType="patient"
          entityId={patientId}
          currentPhotoUrl={currentPhotoUrl}
          firstName={firstName}
          lastName={lastName}
          email={email ?? undefined}
          uploadsEnabled={uploadsEnabled}
          showAdminConfigHint={showUploadConfigHint}
          onPhotoUpdated={setCurrentPhotoUrl}
        />

        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <DynamicPatientForm
            fields={formFields}
            countryCode={countryCode}
            initialValues={values}
            onChange={setValues}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
