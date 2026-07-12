"use client";

import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { createPatient } from "@/app/(dashboard)/features/patients/actions";
import {
  EMPTY_QUICK_REGISTER,
  QuickRegisterForm,
  type QuickRegisterValues,
} from "@/components/patients/quick-register-form";

export type PatientSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  patientId: string | null;
  patientNumber: string;
  phone: string | null;
  allergies: string[];
  insuranceProvider: string | null;
};

type Props = {
  selected: PatientSearchResult | null;
  onSelect: (patient: PatientSearchResult) => void;
  onClear?: () => void;
  /** Called after a successful quick-register selection. */
  onRegistered?: (patient: PatientSearchResult) => void;
  className?: string;
};

export function PatientSearchPicker({
  selected,
  onSelect,
  onClear,
  onRegistered,
  className,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [quickReg, setQuickReg] = useState<QuickRegisterValues>(EMPTY_QUICK_REGISTER);

  useEffect(() => {
    if (patientSearch.length < 2) {
      setPatientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(
        `/api/patients/search?q=${encodeURIComponent(patientSearch)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { patients?: PatientSearchResult[] };
        setPatientResults(data.patients ?? []);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  function handleQuickRegister() {
    if (!quickReg.firstName.trim() || !quickReg.lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }

    startTransition(async () => {
      const result = await createPatient({
        firstName: quickReg.firstName.trim(),
        lastName: quickReg.lastName.trim(),
        phone: quickReg.phone.trim() || undefined,
        email: quickReg.email.trim() || undefined,
        dateOfBirth: quickReg.dateOfBirth || undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? "Registration failed");
        return;
      }

      const p = result.data;
      const patient: PatientSearchResult = {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        patientId: p.patientId,
        patientNumber: p.patientNumber,
        phone: p.phone,
        allergies: p.allergies ?? [],
        insuranceProvider: null,
      };
      onSelect(patient);
      onRegistered?.(patient);
      setPatientSearch(`${p.firstName} ${p.lastName}`);
      setShowQuickRegister(false);
      setQuickReg(EMPTY_QUICK_REGISTER);
      toast.success("Patient registered");
    });
  }

  return (
    <div className={className ?? "space-y-4"}>
      {!selected && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search by name, phone, or patient ID..."
              className="w-full pl-9 pr-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {patientResults.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              {patientResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setPatientSearch(`${p.firstName} ${p.lastName}`);
                    setPatientResults([]);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0 transition-colors"
                >
                  <p className="font-medium text-sm">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.patientId ?? p.patientNumber} · {p.phone}
                    {p.allergies.length > 0 && (
                      <span className="text-red-600 ml-2">
                        ⚠ {p.allergies.join(", ")}
                      </span>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            {!showQuickRegister ? (
              <button
                type="button"
                onClick={() => {
                  setShowQuickRegister(true);
                  if (patientSearch && !quickReg.phone) {
                    setQuickReg((prev) => ({ ...prev, phone: patientSearch }));
                  }
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Patient not found? Register new patient
              </button>
            ) : (
              <QuickRegisterForm
                values={quickReg}
                onChange={setQuickReg}
                onSubmit={handleQuickRegister}
                onCancel={() => setShowQuickRegister(false)}
                isPending={isPending}
              />
            )}
          </div>
        </>
      )}

      {selected && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {selected.firstName[0]}
              {selected.lastName[0]}
            </div>
            <div>
              <p className="font-semibold">
                {selected.firstName} {selected.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {selected.patientId ?? selected.patientNumber}
                {selected.insuranceProvider && ` · ${selected.insuranceProvider}`}
              </p>
            </div>
            {onClear && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setPatientSearch("");
                }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Change
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
