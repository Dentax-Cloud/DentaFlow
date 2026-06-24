import { z } from "zod";
import { ToothConditionType } from "@prisma/client";

const toothSurfaceSchema = z.enum(["M", "D", "O", "B", "L", "I", "V"]);

export const createToothConditionSchema = z.object({
  patientId: z.string(),
  toothNumber: z.string(),
  conditionType: z.nativeEnum(ToothConditionType).optional(),
  type: z.nativeEnum(ToothConditionType).optional(),
  surface: toothSurfaceSchema.optional(),
  surfaces: z.array(toothSurfaceSchema).optional(),
  notes: z.string().optional(),
  appointmentId: z.string().optional(),
  recordedAt: z.string().optional(),
  severity: z.number().min(1).max(5).optional(),
  mobility: z.number().min(0).max(3).optional(),
  pocketDepth: z.number().optional(),
}).transform((data) => ({
  ...data,
  type: data.type ?? data.conditionType ?? ToothConditionType.CARIES,
}));

export const updateToothConditionSchema = z.object({
  patientId: z.string(),
  conditionId: z.string(),
  type: z.nativeEnum(ToothConditionType).optional(),
  surfaces: z.array(toothSurfaceSchema).optional(),
  notes: z.string().optional(),
  recordedAt: z.string().optional(),
});

export const deleteToothConditionSchema = z.object({
  patientId: z.string(),
  conditionId: z.string(),
});

export const toothPatientSchema = z.object({
  patientId: z.string(),
  toothNumber: z.string(),
});

/** @deprecated use createToothConditionSchema */
export const saveToothConditionSchema = createToothConditionSchema;

/** @deprecated use deleteToothConditionSchema */
export const removeToothConditionSchema = deleteToothConditionSchema;

/** @deprecated use note-schemas.ts */
export { saveClinicalNoteSchema } from "./note-schemas";

export const generateSoapSchema = z
  .object({
    rawNotes: z.string().optional(),
    chartSummary: z.string().optional(),
  })
  .refine(
    (v) =>
      (v.rawNotes?.trim().length ?? 0) >= 10 ||
      (v.chartSummary?.trim().length ?? 0) > 0,
    { message: "Enter notes or chart findings for AI generation" },
  );

export const loadPatientChartSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
});

export const saveTreatmentPlanSchema = z.object({
  patientId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  aiSuggested: z.boolean().optional(),
  items: z.array(
    z.object({
      description: z.string(),
      toothNumbers: z.array(z.string()),
      estimatedCost: z.number(),
      phase: z.number(),
    }),
  ),
});
