import { notFound } from "next/navigation";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";

import { isUploadthingConfigured } from "@/lib/uploadthing-env";

import { getPatientById } from "@/app/(dashboard)/features/patients/actions";

import { PatientDetailClient } from "./PatientDetailClient";

import { mapPatientTo360Profile } from "./map-patient-360";



export default async function PatientDetailPage({

  params,

}: {

  params: Promise<{ id: string }>;

}) {

  const { id } = await params;

  const ctx = await requireRouteAccess("patients", "read");

  const patient = await getPatientById(ctx.tenant.id, id);

  if (!patient) notFound();



  return (

    <PatientDetailClient

      patient={mapPatientTo360Profile(patient)}

      uploadsEnabled={isUploadthingConfigured()}

    />

  );

}

