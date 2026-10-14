"use client";

import { useEffect, useState } from "react";
import type { PatientFormField } from "@/lib/countries/patient-form-config";
import { getInsuranceNetworkTypes } from "@/lib/countries";

type Props = {
  fields: PatientFormField[];
  countryCode: string;
  initialValues?: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  readOnly?: boolean;
};

export function DynamicPatientForm({
  fields,
  countryCode,
  initialValues = {},
  onChange,
  readOnly = false,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [networkOptions, setNetworkOptions] = useState<
    Array<{ value: string; label: string; labelAr?: string; secondaryLabel?: string }>
  >([]);

  useEffect(() => {
    setValues(initialValues);
    const provider = initialValues.insuranceProvider;
    if (provider) {
      const networks = getInsuranceNetworkTypes(countryCode, provider);
      setNetworkOptions(networks.map((n) => ({ value: n.code, label: n.name })));
    }
  }, [initialValues, countryCode]);

  function handleChange(key: string, value: string) {
    const next = { ...values, [key]: value };

    if (key === "insuranceProvider") {
      const networks = getInsuranceNetworkTypes(countryCode, value);
      setNetworkOptions(networks.map((n) => ({ value: n.code, label: n.name })));
      next.insuranceNetwork = "";
    }

    setValues(next);
    onChange(next);
  }

  const sections = [
    { key: "IDENTITY", label: "Identity", icon: "🪪" },
    { key: "CONTACT", label: "Contact", icon: "📞" },
    { key: "INSURANCE", label: "Insurance", icon: "🏥" },
    { key: "MEDICAL", label: "Medical", icon: "💊" },
    { key: "ADDITIONAL", label: "Additional", icon: "📋" },
  ] as const;

  function renderField(field: PatientFormField) {
    const value = values[field.key] ?? "";
    const commonProps = {
      id: field.key,
      disabled: readOnly,
      className: `mt-1 w-full rounded-md border px-3 py-2 text-sm ${
        readOnly ? "bg-gray-50" : "bg-white"
      } ${field.isCustom ? "border-blue-200" : ""}`,
    };

    const opts =
      field.key === "insuranceNetwork" ? networkOptions : (field.options ?? []);

    switch (field.type) {
      case "select":
        return (
          <select
            {...commonProps}
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
          >
            <option value="">— Select —</option>
            {opts.map((opt) => {
              const optSecondary = opt.secondaryLabel ?? opt.labelAr;
              return (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                  {optSecondary ? ` / ${optSecondary}` : ""}
                </option>
              );
            })}
          </select>
        );

      case "date":
        return (
          <input
            {...commonProps}
            type="date"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
          />
        );

      case "textarea":
        return (
          <textarea
            {...commonProps}
            value={value}
            rows={3}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={`${commonProps.className} resize-none`}
          />
        );

      default:
        return (
          <input
            {...commonProps}
            type={field.type === "phone" ? "tel" : field.type}
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        );
    }
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const sectionFields = fields.filter((f) => f.section === section.key);
        if (sectionFields.length === 0) return null;

        return (
          <div key={section.key}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{section.icon}</span>
              {section.label}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sectionFields.map((field) => (
                <div
                  key={field.key}
                  className={field.type === "textarea" ? "md:col-span-2" : ""}
                >
                  <label
                    htmlFor={field.key}
                    className="flex items-center gap-1 text-sm font-medium"
                  >
                    {field.label}
                    {(() => {
                      const secondary = field.secondaryLabel ?? field.labelAr;
                      return secondary ? (
                        <span className="text-xs text-muted-foreground">/ {secondary}</span>
                      ) : null;
                    })()}
                    {field.mandatory && <span className="text-xs text-red-500">*</span>}
                    {field.isCustom && (
                      <span className="rounded border border-blue-200 px-1 text-[10px] text-blue-400">
                        custom
                      </span>
                    )}
                  </label>
                  {renderField(field)}
                  {field.helpText && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{field.helpText}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
