import { generateText } from "ai";
import { openai, DEFAULT_MODEL, SYSTEM_SAFETY } from "./client";

export async function enhanceClinicalText(text: string): Promise<string> {
  const { text: enhanced } = await generateText({
    model: openai(DEFAULT_MODEL),
    system: `${SYSTEM_SAFETY} You improve dental clinical documentation. Preserve medical facts; improve clarity, grammar, and professional tone. Do not add diagnoses or treatments not present in the source. Return only the improved text.`,
    prompt: `Improve this clinical note text:\n\n${text}`,
  });
  return enhanced.trim();
}
