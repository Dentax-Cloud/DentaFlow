import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, openai, SYSTEM_SAFETY } from "./client";

const soapSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
});

export type SoapNote = z.infer<typeof soapSchema>;

export async function generateClinicalNotes(rawNotes: string): Promise<SoapNote> {
  const { object } = await generateObject({
    model: openai(DEFAULT_MODEL),
    schema: soapSchema,
    system: `${SYSTEM_SAFETY} Convert rough dentist notes into a structured SOAP note.`,
    prompt: `Raw clinical notes:\n\n${rawNotes}`,
  });
  return object;
}
