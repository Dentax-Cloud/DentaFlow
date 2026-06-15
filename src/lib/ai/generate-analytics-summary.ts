import { generateText } from "ai";
import { DEFAULT_MODEL, openai, SYSTEM_SAFETY } from "./client";

export async function generateAnalyticsSummary(
  metrics: Record<string, number | string>,
): Promise<string> {
  const { text } = await generateText({
    model: openai(DEFAULT_MODEL),
    system: `${SYSTEM_SAFETY} Write concise business insights for a dental clinic manager.`,
    prompt: `Summarize these KPIs in 3-5 bullet points with actionable insights:\n${JSON.stringify(metrics, null, 2)}`,
    maxTokens: 500,
  });
  return text;
}
