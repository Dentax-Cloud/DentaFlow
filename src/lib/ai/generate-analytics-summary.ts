import { generateText } from "ai";
import { resolveOpenAIModel, SYSTEM_SAFETY } from "./client";

export async function generateAnalyticsSummary(
  metrics: Record<string, number | string>,
): Promise<string> {
  const model = await resolveOpenAIModel();
  if (!model) return "AI not configured — enable OpenAI in Platform Settings.";

  const { text } = await generateText({
    model,
    system: `${SYSTEM_SAFETY} Write concise business insights for a dental clinic manager.`,
    prompt: `Summarize these KPIs in 3-5 bullet points with actionable insights:\n${JSON.stringify(metrics, null, 2)}`,
    maxTokens: 500,
  });
  return text;
}
