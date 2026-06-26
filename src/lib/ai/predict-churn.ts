import { generateObject } from "ai";
import { z } from "zod";
import { resolveOpenAIModel } from "./client";

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
  const model = await resolveOpenAIModel();
  if (!model) {
    return {
      riskLevel: "LOW",
      score: 0,
      factors: ["AI not configured"],
      recommendedActions: [],
    };
  }

  const { object } = await generateObject({
    model,
    schema: churnSchema,
    system: "Identify patients at risk of churning from the practice.",
    prompt: JSON.stringify(patientHistory),
  });
  return object;
}
