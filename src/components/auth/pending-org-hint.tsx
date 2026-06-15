"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { PENDING_REGISTRATION_KEY } from "@/lib/auth/countries";

export function PendingOrgHint() {
  const [clinicName, setClinicName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_REGISTRATION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { clinicName?: string };
      if (saved.clinicName) setClinicName(saved.clinicName);
    } catch {
      // ignore
    }
  }, []);

  if (!clinicName) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-sm">
      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
      <p className="text-zinc-300">
        Create an organization named{" "}
        <span className="font-semibold text-white">{clinicName}</span> to match your registration.
      </p>
    </div>
  );
}
