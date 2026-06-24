"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createEmergencyIntake } from "@/app/(dashboard)/features/clinical/emergency-actions";
import {
  CHIEF_COMPLAINTS,
  ONSET_OPTIONS,
  AGGRAVATING_OPTIONS,
  RELIEVING_OPTIONS,
  calculateTriageLevel,
  TRIAGE_CONFIG,
  type Vitals,
} from "@/lib/clinical/emergency-types";
import { PainScoreSelector } from "./pain-score-selector";
import { VitalsEntry } from "./vitals-entry";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  allergies?: string[] | null;
  medications?: string[] | null;
};

type Props = {
  patients: Patient[];
  defaultPatientId?: string;
  onCreated?: (intakeId: string) => void;
};

export function EmergencyIntakeForm({ patients, defaultPatientId, onCreated }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [patientId, setPatientId] = useState(defaultPatientId ?? "");
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
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const triageLevel = complaint ? calculateTriageLevel(painScore, complaint) : null;
  const triageConfig = triageLevel ? TRIAGE_CONFIG[triageLevel] : null;
  const selectedPatient = patients.find((p) => p.id === patientId);

  useEffect(() => {
    if (!selectedPatient) return;
    if (selectedPatient.allergies?.length) {
      setAllergies(selectedPatient.allergies.join(", "));
    }
    if (selectedPatient.medications?.length) {
      setMedications(selectedPatient.medications.join(", "));
    }
  }, [selectedPatient]);

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
    if (!patientId || !complaint) return;

    startTransition(async () => {
      try {
        const result = await createEmergencyIntake({
          patientId,
          chiefComplaint: complaint,
          painScore,
          painLocation: painLocation || undefined,
          onset: onset || undefined,
          aggravating: aggravating.length > 0 ? aggravating : undefined,
          relieving: relieving.length > 0 ? relieving : undefined,
          vitals: Object.keys(vitals).length > 0 ? vitals : undefined,
          allergies: allergies || undefined,
          medications: medications || undefined,
        });

        toast.success("Emergency registered");
        onCreated?.(result.intake.id);
        router.push(`/clinical/emergency?intakeId=${result.intake.id}`);
        router.refresh();
      } catch {
        toast.error("Failed to register emergency");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Patient & complaint" },
          { n: 2, label: "Details" },
          { n: 3, label: "Review" },
        ].map((s) => (
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
            {s.n < 3 && <div className="h-px flex-1 bg-muted" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <Card className="p-4">
            <h3 className="mb-3 font-medium">🧑 Patient</h3>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">— Search patient —</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName}, {p.firstName}
                  {p.phone ? ` · ${p.phone}` : ""}
                </option>
              ))}
            </select>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-medium">🚨 Chief complaint</h3>
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
            <h3 className="mb-3 font-medium">💊 Pain score</h3>
            <PainScoreSelector value={painScore} onChange={setPainScore} />
          </Card>

          {triageConfig && triageLevel && (
            <div
              className={`rounded-lg border-2 p-4 ${triageConfig.borderColor} ${triageConfig.bgColor}`}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {triageLevel === "IMMEDIATE"
                    ? "🚨"
                    : triageLevel === "URGENT"
                      ? "⚠️"
                      : triageLevel === "SEMI_URGENT"
                        ? "🟡"
                        : "🟢"}
                </div>
                <div>
                  <p className={`font-bold ${triageConfig.color}`}>{triageConfig.label}</p>
                  <p className={`text-sm ${triageConfig.color}`}>{triageConfig.description}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={() => setStep(2)}
            disabled={!patientId || !complaint}
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
            <h3 className="mb-2 font-medium">📍 Pain location</h3>
            <input
              value={painLocation}
              onChange={(e) => setPainLocation(e.target.value)}
              placeholder="e.g. Upper right molar, tooth 16"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-medium">⏱ When did it start?</h3>
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
            <h3 className="mb-3 font-medium">⬆ What makes it worse?</h3>
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
            <h3 className="mb-3 font-medium">⬇ What helps?</h3>
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
            <h3 className="mb-3 font-medium">💊 Medical history</h3>
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
                🩺 Vitals{" "}
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
              Review →
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h3 className="font-medium">Review intake</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Patient</p>
                <p className="font-medium">
                  {selectedPatient?.firstName} {selectedPatient?.lastName}
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
              {painLocation && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium">{painLocation}</p>
                </div>
              )}
              {onset && (
                <div>
                  <p className="text-xs text-muted-foreground">Onset</p>
                  <p className="font-medium">
                    {ONSET_OPTIONS[onset as keyof typeof ONSET_OPTIONS]}
                  </p>
                </div>
              )}
              {aggravating.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Aggravating</p>
                  <p className="font-medium">{aggravating.join(", ")}</p>
                </div>
              )}
              {relieving.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Relieving</p>
                  <p className="font-medium">{relieving.join(", ")}</p>
                </div>
              )}
              {allergies && (
                <div>
                  <p className="text-xs text-muted-foreground">Allergies</p>
                  <p className="font-medium text-red-600">{allergies}</p>
                </div>
              )}
              {medications && (
                <div>
                  <p className="text-xs text-muted-foreground">Medications</p>
                  <p className="font-medium">{medications}</p>
                </div>
              )}
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1" type="button">
              ← Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 bg-red-600 hover:bg-red-700"
              size="lg"
              type="button"
            >
              {isPending ? "Registering..." : "🚨 Register emergency"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
