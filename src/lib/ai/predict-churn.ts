import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, openai } from "./client";

const churnSchema = z.object({
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  score: z.number().min(0).max(100),
  factors: z.array(z.string()),
  recommendedActions: z.array(z.string()),
});

export type ChurnPrediction = z.infer<typeof churnSchema>;

export async function predictChurnRisk(patientHistory: {
  lastVisitDaysAgo: number;
  missedRecalls: number;
  outstandingBalance: number;
  visitFrequencyPerYear: number;
}): Promise<ChurnPrediction> {
  const { object } = await generateObject({
    model: openai(DEFAULT_MODEL),
    schema: churnSchema,
    system: "Identify patients at risk of churning from the practice.",
    prompt: JSON.stringify(patientHistory),
  });
  return object;
}
