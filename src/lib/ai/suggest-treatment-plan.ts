import { generateObject } from "ai";
import { z } from "zod";
import { resolveOpenAIModel, SYSTEM_SAFETY } from "./client";

const suggestionSchema = z.object({
  basic: z.array(
    z.object({
      description: z.string(),
      toothNumbers: z.array(z.string()),
      estimatedCost: z.number(),
      phase: z.number(),
    }),
  ),
  premium: z.array(
    z.object({
      description: z.string(),
      toothNumbers: z.array(z.string()),
      estimatedCost: z.number(),
      phase: z.number(),
    }),
  ),
  rationale: z.string(),
});

export type TreatmentSuggestion = z.infer<typeof suggestionSchema>;

export async function suggestTreatmentPlan(
  patientData: { age?: number; history?: string },
  chartData: { conditions: Array<{ tooth: string; type: string }> },
): Promise<TreatmentSuggestion> {
  const model = await resolveOpenAIModel();
  if (!model) throw new Error("AI not configured");

  const { object } = await generateObject({
    model,
    schema: suggestionSchema,
    system: `${SYSTEM_SAFETY} Suggest treatment plan OPTIONS only. Dentist must approve.`,
    prompt: JSON.stringify({ patientData, chartData }),
  });
  return object;
}
