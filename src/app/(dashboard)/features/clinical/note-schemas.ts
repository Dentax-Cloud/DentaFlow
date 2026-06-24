import { z } from "zod";
import { CLINICAL_TEMPLATE_TYPES } from "@/lib/clinical/render-template";

export const clinicalTemplateInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(CLINICAL_TEMPLATE_TYPES),
  content: z.string().min(1),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateClinicalTemplateSchema = clinicalTemplateInputSchema.partial().extend({
  id: z.string(),
});

export const templateIdSchema = z.object({
  id: z.string(),
});

export const listTemplatesSchema = z.object({
  type: z.enum(CLINICAL_TEMPLATE_TYPES).optional(),
});

export const renderTemplateSchema = z.object({
  templateId: z.string(),
  variables: z.record(z.union([z.string(), z.number()])).optional(),
});

export const createNoteFromTemplateSchema = z.object({
  templateId: z.string(),
  patientId: z.string(),
  appointmentId: z.string().optional(),
  variables: z.record(z.union([z.string(), z.number()])).optional(),
  toothNumbers: z.array(z.string()).optional(),
});

export const saveClinicalNoteSchema = z.object({
  patientId: z.string(),
  appointmentId: z.string().optional(),
  templateId: z.string().optional(),
  noteType: z.enum(CLINICAL_TEMPLATE_TYPES).optional(),
  title: z.string().optional(),
  rawNotes: z.string().optional(),
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  bodyHtml: z.string().optional(),
  toothNumbers: z.array(z.string()).optional(),
  aiGenerated: z.boolean().optional(),
  aiEnhanced: z.boolean().optional(),
});

export const updateClinicalNoteSchema = saveClinicalNoteSchema.extend({
  noteId: z.string(),
});

export const noteIdSchema = z.object({
  noteId: z.string(),
  patientId: z.string(),
});

export const noteAutoFillSchema = z.object({
  patientId: z.string(),
  appointmentId: z.string().optional(),
});

export const enhanceNoteTextSchema = z.object({
  text: z.string().min(10, "Enter at least 10 characters to enhance"),
});
