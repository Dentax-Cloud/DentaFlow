export const CLINICAL_TEMPLATE_TYPES = [
  "SOAP",
  "PROCEDURE_NOTE",
  "POST_OP",
  "CONSULTATION",
  "EMERGENCY",
  "CUSTOM",
] as const;

export type ClinicalTemplateType = (typeof CLINICAL_TEMPLATE_TYPES)[number];

export const TEMPLATE_PLACEHOLDERS = [
  "patient_name",
  "doctor_name",
  "clinic_name",
  "date",
  "chief_complaint",
  "pain_score",
  "findings",
  "tooth_numbers",
  "conditions",
  "diagnosis",
  "procedures",
  "procedure_name",
  "followup_weeks",
  "next_appointment",
  "avoid_days",
] as const;

export type TemplateVariables = Partial<
  Record<(typeof TEMPLATE_PLACEHOLDERS)[number], string | number>
>;

/** Replace {{placeholder}} tokens in template content. */
export function renderTemplateContent(
  content: string,
  variables: TemplateVariables,
): string {
  return content.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    const value = variables[key as keyof TemplateVariables];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

/** Split SOAP-style template into sections when using structured editor. */
export function parseSoapSections(rendered: string): {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
} {
  const sections = { subjective: "", objective: "", assessment: "", plan: "" };
  const lines = rendered.split("\n");
  let current: keyof typeof sections | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^S[:\.]/i.test(trimmed)) {
      current = "subjective";
      sections.subjective = trimmed.replace(/^S[:\.]\s*/i, "");
      continue;
    }
    if (/^O[:\.]/i.test(trimmed)) {
      current = "objective";
      sections.objective = trimmed.replace(/^O[:\.]\s*/i, "");
      continue;
    }
    if (/^A[:\.]/i.test(trimmed)) {
      current = "assessment";
      sections.assessment = trimmed.replace(/^A[:\.]\s*/i, "");
      continue;
    }
    if (/^P[:\.]/i.test(trimmed)) {
      current = "plan";
      sections.plan = trimmed.replace(/^P[:\.]\s*/i, "");
      continue;
    }
    if (current) {
      sections[current] = sections[current]
        ? `${sections[current]}\n${line}`
        : line;
    }
  }

  if (!sections.subjective && !sections.objective) {
    return {
      subjective: "",
      objective: rendered,
      assessment: "",
      plan: "",
    };
  }

  return sections;
}

export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
