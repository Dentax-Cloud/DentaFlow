import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, openai, SYSTEM_SAFETY } from "./client";

const templateSchema = z.object({
  sms: z.string().max(160),
  emailSubject: z.string(),
  emailBody: z.string(),
  whatsapp: z.string(),
});

export type CampaignTemplate = z.infer<typeof templateSchema>;

export async function generateCampaignTemplate(intent: string): Promise<CampaignTemplate> {
  const { object } = await generateObject({
    model: openai(DEFAULT_MODEL),
    schema: templateSchema,
    system: `${SYSTEM_SAFETY} Generate marketing templates for a dental clinic. Professional, friendly tone.`,
    prompt: `Campaign intent: ${intent}`,
  });
  return object;
}
