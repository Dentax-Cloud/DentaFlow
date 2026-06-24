import type { ClinicalTemplateType } from "./render-template";

export type DefaultTemplateSeed = {
  name: string;
  type: ClinicalTemplateType;
  content: string;
  isDefault?: boolean;
};

export const PLATFORM_DEFAULT_TEMPLATES: DefaultTemplateSeed[] = [
  {
    name: "Standard SOAP Note",
    type: "SOAP",
    isDefault: true,
    content: `S: Patient presents with {{chief_complaint}}. Pain score {{pain_score}}/10.

O: Clinical examination reveals {{findings}}.

Tooth {{tooth_numbers}}: {{conditions}}.

A: {{diagnosis}}

P: Treatment plan: {{procedures}}.

Follow-up in {{followup_weeks}} weeks.`,
  },
  {
    name: "Procedure Note",
    type: "PROCEDURE_NOTE",
    isDefault: true,
    content: `Procedure: {{procedure_name}}
Patient: {{patient_name}}
Date: {{date}}
Provider: {{doctor_name}}

Clinical findings: {{findings}}
Teeth involved: {{tooth_numbers}}

Procedure performed: {{procedures}}

Post-operative instructions discussed with patient.`,
  },
  {
    name: "Post-Op Instructions",
    type: "POST_OP",
    isDefault: true,
    content: `Following your {{procedure_name}} on {{date}}, please note:

Avoid hard foods for {{avoid_days}} days
Take prescribed medication as directed
Contact us if you experience: severe pain, swelling, or bleeding
Your next appointment: {{next_appointment}}

Clinic: {{clinic_name}}`,
  },
  {
    name: "Consultation Note",
    type: "CONSULTATION",
    isDefault: true,
    content: `Consultation — {{patient_name}}
Date: {{date}}
Provider: {{doctor_name}}

Chief complaint: {{chief_complaint}}

Examination: {{findings}}
Teeth: {{tooth_numbers}} — {{conditions}}

Assessment: {{diagnosis}}

Recommended treatment: {{procedures}}
Follow-up: {{followup_weeks}} weeks`,
  },
  {
    name: "Emergency Visit",
    type: "EMERGENCY",
    isDefault: true,
    content: `Emergency visit — {{patient_name}}
Date: {{date}}

Chief complaint: {{chief_complaint}}
Pain score: {{pain_score}}/10

Findings: {{findings}}
Teeth: {{tooth_numbers}}

Assessment: {{diagnosis}}

Emergency treatment: {{procedures}}`,
  },
];
