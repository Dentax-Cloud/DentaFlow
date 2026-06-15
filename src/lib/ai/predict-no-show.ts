import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, openai } from "./client";

const predictionSchema = z.object({
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  confidence: z.number().min(0).max(1),
  factors: z.array(z.string()),
  suggestedSlots: z.array(z.string()).optional(),
});

export type NoShowPrediction = z.infer<typeof predictionSchema>;

export async function predictNoShowRisk(appointmentHistory: {
  totalAppointments: number;
  noShows: number;
  cancellations: number;
  dayOfWeek: string;
  hour: number;
  patientNoShowHistory: number;
}): Promise<NoShowPrediction> {
  const { object } = await generateObject({
    model: openai(DEFAULT_MODEL),
    schema: predictionSchema,
    system: "Predict appointment no-show risk based on historical patterns.",
    prompt: JSON.stringify(appointmentHistory),
  });
  return object;
}
