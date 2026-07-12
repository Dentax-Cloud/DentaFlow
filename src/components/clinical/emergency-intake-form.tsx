"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createEmergencyIntake } from "@/app/(dashboard)/features/clinical/emergency-actions";
import { getEmergencyDoctorOptions } from "@/app/(dashboard)/features/appointments/appointment-booking-actions";
import {
  CHIEF_COMPLAINTS,
  ONSET_OPTIONS,
  AGGRAVATING_OPTIONS,
  RELIEVING_OPTIONS,
  calculateTriageLevel,
  TRIAGE_CONFIG,
  getComplaintLabel,
  type Vitals,
} from "@/lib/clinical/emergency-types";
import type { DoctorNowStatus } from "@/lib/appointments/availability";
import { PainScoreSelector } from "./pain-score-selector";
import { VitalsEntry } from "./vitals-entry";
import {
  PatientSearchPicker,
  type PatientSearchResult,
} from "@/components/patients/patient-search-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Props = {
  /** @deprecated Prefer search/quick-register; kept for page compatibility */
  patients?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    allergies?: string[] | null;
    medications?: string[] | null;
  }>;
  defaultPatientId?: string;
  onCreated?: (intakeId: string) => void;
};

export function EmergencyIntakeForm({ defaultPatientId, onCreated }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [complaint, setComplaint] = useState("");
  const [painScore, setPainScore] = useState(5);
  const [painLocation, setPainLocation] = useState("");
  const [onset, setOnset] = useState("");
  const [aggravating, setAggravating] = useState<string[]>([]);
  const [relieving, setRelieving] = useState<string[]>([]);
  const [vitals, setVitals] = useState<Vitals>({});
  const [showVitals, setShowVitals] = useState(false);
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [priorityReason, setPriorityReason] = useState("");
  const [doctors, setDoctors] = useState<DoctorNowStatus[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [when, setWhen] = useState<"NOW" | "AFTER_CURRENT">("NOW");
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const triageLevel = complaint ? calculateTriageLevel(painScore, complaint) : null;
  const triageConfig = triageLevel ? TRIAGE_CONFIG[triageLevel] : null;
  const selectedDoctor = doctors.find((d) => d.doctorId === doctorId);

  useEffect(() => {
    if (!complaint) return;
    setPriorityReason((prev) =>
      prev.trim() ? prev : getComplaintLabel(complaint),
    );
  }, [complaint]);

  useEffect(() => {
    if (patient?.allergies?.length) {
      setAllergies(patient.allergies.join(", "));
    }
  }, [patient]);

  useEffect(() => {
    if (step !== 3) return;
    setLoadingDoctors(true);
    getEmergencyDoctorOptions()
      .then((list) => {
        setDoctors(list);
        if (list.length === 1 && list[0]) {
          setDoctorId(list[0].doctorId);
          setWhen(list[0].status === "IN_CHAIR" ? "AFTER_CURRENT" : "NOW");
        }
      })
      .catch(() => {
        toast.error("Could not load available doctors");
        setDoctors([]);
      })
      .finally(() => setLoadingDoctors(false));
  }, [step]);

  useEffect(() => {
    if (!defaultPatientId || patient) return;
    // Prefill via search API when deep-linked
    void fetch(`/api/patients/search?q=${encodeURIComponent(defaultPatientId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { patients?: PatientSearchResult[] } | null) => {
        const match = data?.patients?.find((p) => p.id === defaultPatientId);
        if (match) setPatient(match);
      })
      .catch(() => null);
  }, [defaultPatientId, patient]);

  function toggleAggravating(item: string) {
    setAggravating((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    );
  }

  function toggleRelieving(item: string) {
    setRelieving((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    );
  }

  function handleSubmit() {
    if (!patient || !complaint || !doctorId) return;
    if (!priorityReason.trim()) {
      toast.error("Priority reason is required for emergencies");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createEmergencyIntake({
          patientId: patient.id,
          chiefComplaint: complaint,
          painScore,
          painLocation: painLocation || undefined,
          onset: onset || undefined,
          aggravating: aggravating.length > 0 ? aggravating : undefined,
          relieving: relieving.length > 0 ? relieving : undefined,
          vitals: Object.keys(vitals).length > 0 ? vitals : undefined,
          allergies: allergies || undefined,
          medications: medications || undefined,
          doctorId,
          when,
          priorityReason: priorityReason.trim(),
        });

        toast.success("Emergency registered with appointment");
        onCreated?.(result.intake.id);
        router.push(`/clinical/emergency?intakeId=${result.intake.id}`);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to register emergency";
        toast.error(message);
      }
    });
  }

  const stepLabels = [
    { n: 1 as const, label: "Patient & complaint" },
    { n: 2 as const, label: "Details" },
    { n: 3 as const, label: "Assign doctor" },
    { n: 4 as const, label: "Review" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        {stepLabels.map((s) => (
          <div key={s.n} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                step >= s.n ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {s.n}
            </div>
            <span
              className={`hidden text-xs sm:block ${
                step >= s.n ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {s.n < 4 && <div className="h-px flex-1 bg-muted" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <Card className="p-4">
            <h3 className="mb-3 font-medium">Patient</h3>
            <PatientSearchPicker
              selected={patient}
              onSelect={setPatient}
              onClear={() => setPatient(null)}
            />
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-medium">Chief complaint</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CHIEF_COMPLAINTS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setComplaint(c.value)}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    complaint === c.value
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="block text-xl">{c.icon}</span>
                  <span className="mt-1 block text-xs font-medium">{c.label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-medium">Pain score</h3>
            <PainScoreSelector value={painScore} onChange={setPainScore} />
          </Card>

          {triageConfig && triageLevel && (
            <div
              className={`rounded-lg border-2 p-4 ${triageConfig.borderColor} ${triageConfig.bgColor}`}
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className={`font-bold ${triageConfig.color}`}>{triageConfig.label}</p>
                  <p className={`text-sm ${triageConfig.color}`}>{triageConfig.description}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={() => setStep(2)}
            disabled={!patient || !complaint}
            className="w-full"
            size="lg"
            type="button"
          >
            Next →
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-2 font-medium">Pain location</h3>
            <input
              value={painLocation}
              onChange={(e) => setPainLocation(e.target.value)}
              placeholder="e.g. Upper right molar, tooth 16"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-medium">When did it start?</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(ONSET_OPTIONS) as [string, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOnset(value)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                    onset === value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-medium">What makes it worse?</h3>
            <div className="flex flex-wrap gap-2">
              {AGGRAVATING_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleAggravating(opt)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                    aggravating.includes(opt)
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-medium">What helps?</h3>
            <div className="flex flex-wrap gap-2">
              {RELIEVING_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleRelieving(opt)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                    relieving.includes(opt)
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-medium">Medical history</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Allergies</label>
                <input
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, NKDA"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Current medications</label>
                <input
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  placeholder="e.g. Ibuprofen 400mg PRN"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <button
              type="button"
              onClick={() => setShowVitals(!showVitals)}
              className="flex w-full items-center justify-between"
            >
              <h3 className="font-medium">
                Vitals{" "}
                <span className="text-sm font-normal text-muted-foreground">(optional)</span>
              </h3>
              <span className="text-muted-foreground">{showVitals ? "▲" : "▼"}</span>
            </button>
            {showVitals && (
              <div className="mt-3">
                <VitalsEntry value={vitals} onChange={setVitals} />
              </div>
            )}
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1" type="button">
              ← Back
            </Button>
            <Button onClick={() => setStep(3)} className="flex-1" type="button">
              Assign doctor →
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="font-medium">Who will see this patient?</h3>
            <p className="text-sm text-muted-foreground">
              Select an available doctor. Existing bookings are never cancelled or moved.
            </p>
            {loadingDoctors ? (
              <p className="text-sm text-muted-foreground">Loading doctors…</p>
            ) : doctors.length === 0 ? (
              <p className="text-sm text-red-600">
                No doctors with a schedule today. Configure schedules in admin first.
              </p>
            ) : (
              <div className="space-y-2">
                {doctors.map((doc) => (
                  <button
                    key={doc.doctorId}
                    type="button"
                    onClick={() => {
                      setDoctorId(doc.doctorId);
                      setWhen(doc.status === "IN_CHAIR" ? "AFTER_CURRENT" : "NOW");
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      doctorId === doc.doctorId
                        ? "border-red-500 bg-red-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{doc.doctorName}</p>
                        {doc.specialization && (
                          <p className="text-xs text-muted-foreground">{doc.specialization}</p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          doc.status === "FREE_NOW"
                            ? "text-green-700"
                            : doc.status === "IN_CHAIR"
                              ? "text-purple-700"
                              : "text-amber-700"
                        }`}
                      >
                        {doc.status === "FREE_NOW"
                          ? "Free now"
                          : doc.status === "IN_CHAIR"
                            ? `In chair${doc.currentPatientName ? `: ${doc.currentPatientName}` : ""}`
                            : "Has waiting"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {doctorId && (
            <Card className="p-4 space-y-3">
              <h3 className="font-medium">When should they be seen?</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWhen("NOW")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    when === "NOW" ? "border-red-500 bg-red-50" : "hover:bg-gray-50"
                  }`}
                >
                  Now
                </button>
                <button
                  type="button"
                  onClick={() => setWhen("AFTER_CURRENT")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    when === "AFTER_CURRENT"
                      ? "border-red-500 bg-red-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  After current patient
                </button>
              </div>
              {when === "AFTER_CURRENT" && selectedDoctor?.currentEndTime && (
                <p className="text-xs text-muted-foreground">
                  Estimated after{" "}
                  {new Date(selectedDoctor.currentEndTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </Card>
          )}

          <Card className="p-4 space-y-2">
            <h3 className="font-medium">Priority reason *</h3>
            <p className="text-xs text-muted-foreground">
              Required for emergency appointments. Auto-filled from complaint; editable.
            </p>
            <textarea
              value={priorityReason}
              onChange={(e) => setPriorityReason(e.target.value)}
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm resize-none"
              placeholder="Why is this an emergency?"
            />
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1" type="button">
              ← Back
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={!doctorId || !priorityReason.trim()}
              className="flex-1"
              type="button"
            >
              Review →
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h3 className="font-medium">Review intake</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Patient</p>
                <p className="font-medium">
                  {patient?.firstName} {patient?.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Complaint</p>
                <p className="font-medium">
                  {CHIEF_COMPLAINTS.find((c) => c.value === complaint)?.label}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pain score</p>
                <p className="font-medium">{painScore}/10</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Triage</p>
                {triageConfig && (
                  <span className={`text-sm font-bold ${triageConfig.color}`}>
                    {triageConfig.label}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Doctor</p>
                <p className="font-medium">{selectedDoctor?.doctorName ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">When</p>
                <p className="font-medium">
                  {when === "NOW" ? "Now" : "After current patient"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Priority reason</p>
                <p className="font-medium">{priorityReason}</p>
              </div>
              {painLocation && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium">{painLocation}</p>
                </div>
              )}
              {allergies && (
                <div>
                  <p className="text-xs text-muted-foreground">Allergies</p>
                  <p className="font-medium text-red-600">{allergies}</p>
                </div>
              )}
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)} className="flex-1" type="button">
              ← Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 bg-red-600 hover:bg-red-700"
              size="lg"
              type="button"
            >
              {isPending ? "Registering..." : "Register emergency"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
