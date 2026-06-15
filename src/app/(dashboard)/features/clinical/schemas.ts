import { z } from "zod";

import { ToothConditionType } from "@prisma/client";



export const saveToothConditionSchema = z.object({

  patientId: z.string(),

  toothNumber: z.string(),

  type: z.nativeEnum(ToothConditionType),

  surfaces: z.array(z.string()).optional(),

  severity: z.number().min(1).max(5).optional(),

  mobility: z.number().min(0).max(3).optional(),

  pocketDepth: z.number().optional(),

  notes: z.string().optional(),

});



export const removeToothConditionSchema = z.object({

  patientId: z.string(),

  conditionId: z.string(),

});



export const saveClinicalNoteSchema = z.object({

  patientId: z.string(),

  rawNotes: z.string().optional(),

  subjective: z.string().optional(),

  objective: z.string().optional(),

  assessment: z.string().optional(),

  plan: z.string().optional(),

  aiGenerated: z.boolean().optional(),

});



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

