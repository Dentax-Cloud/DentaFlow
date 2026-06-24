"use client";

import type { Vitals } from "@/lib/clinical/emergency-types";

type Props = {
  value: Vitals;
  onChange: (vitals: Vitals) => void;
};

export function VitalsEntry({ value, onChange }: Props) {
  function update(field: keyof Vitals, val: string) {
    onChange({
      ...value,
      [field]: field === "bp" ? val : parseFloat(val) || undefined,
    });
  }

  const fields: Array<{
    key: keyof Vitals;
    label: string;
    unit: string;
    type: string;
    placeholder: string;
    normal: string;
  }> = [
    { key: "bp", label: "Blood pressure", unit: "mmHg", type: "text", placeholder: "120/80", normal: "< 140/90" },
    { key: "pulse", label: "Pulse rate", unit: "bpm", type: "number", placeholder: "72", normal: "60–100" },
    { key: "temp", label: "Temperature", unit: "°C", type: "number", placeholder: "36.6", normal: "36.1–37.2" },
    { key: "spo2", label: "SpO2", unit: "%", type: "number", placeholder: "98", normal: "≥95%" },
    { key: "respRate", label: "Resp. rate", unit: "/min", type: "number", placeholder: "16", normal: "12–20" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
          <div className="relative">
            <input
              type={f.type}
              value={(value[f.key] as string | number) ?? ""}
              onChange={(e) => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full rounded-md border px-3 py-2 pr-12 text-sm"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {f.unit}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">Normal: {f.normal}</p>
        </div>
      ))}
    </div>
  );
}
