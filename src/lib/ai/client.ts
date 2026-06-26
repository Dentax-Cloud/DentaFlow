import { createOpenAI } from "@ai-sdk/openai";
import { getSetting } from "@/lib/settings/platform-settings";

export const SYSTEM_SAFETY =
  "You are a dental practice assistant. Never provide medical diagnoses or treatment advice to patients. " +
  "For clinical tasks, structure information only — licensed dentists make all decisions. " +
  "If asked for medical advice, decline politely and suggest consulting their dentist.";

export const DEFAULT_MODEL = "gpt-4o-mini";

export async function getAIClient() {
  const [apiKey, model, enabled] = await Promise.all([
    getSetting("OPENAI_API_KEY"),
    getSetting("OPENAI_MODEL"),
    getSetting("AI_ENABLED"),
  ]);

  if (!apiKey || enabled === "false") return null;

  return {
    apiKey,
    model: model ?? DEFAULT_MODEL,
  };
}

/** Resolve an @ai-sdk/openai model for generateText / generateObject. */
export async function resolveOpenAIModel(preferred?: string) {
  const ai = await getAIClient();
  if (!ai) return null;
  const provider = createOpenAI({ apiKey: ai.apiKey });
  return provider(preferred ?? ai.model);
}

export async function isAIConfigured(): Promise<boolean> {
  return (await getAIClient()) !== null;
}
