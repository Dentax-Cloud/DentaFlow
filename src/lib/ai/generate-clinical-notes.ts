import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, resolveOpenAIModel, SYSTEM_SAFETY } from "./client";

const soapSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
});

export type SoapNote = z.infer<typeof soapSchema>;

export async function generateClinicalNotes(rawNotes: string): Promise<SoapNote> {
  const model = await resolveOpenAIModel();
  if (!model) throw new Error("AI not configured");

  const { object } = await generateObject({
    model,
    schema: soapSchema,
    system: `${SYSTEM_SAFETY} Convert rough dentist notes into a structured SOAP note.`,
    prompt: `Raw clinical notes:\n\n${rawNotes}`,
  });
  return object;
}
