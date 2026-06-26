import { streamText } from "ai";
import { resolveOpenAIModel, SYSTEM_SAFETY } from "./client";

export type ChatContext = {
  role: "staff" | "patient";
  tenantName: string;
  pageContext?: string;
};

export async function chatWithStaffOrPatient(
  context: ChatContext,
  messages: { role: "user" | "assistant"; content: string }[],
) {
  const model = await resolveOpenAIModel();
  if (!model) throw new Error("AI not configured");

  const roleContext =
    context.role === "patient"
      ? "You are helping a dental patient with scheduling, billing, and general practice info only."
      : "You are helping dental clinic staff with practice operations.";

  return streamText({
    model,
    system: `${SYSTEM_SAFETY}\n${roleContext}\nClinic: ${context.tenantName}\n${context.pageContext ?? ""}`,
    messages,
    maxTokens: 800,
  });
}
