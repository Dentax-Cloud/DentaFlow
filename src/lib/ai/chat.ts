import { streamText } from "ai";
import { DEFAULT_MODEL, openai, SYSTEM_SAFETY } from "./client";

export type ChatContext = {
  role: "staff" | "patient";
  tenantName: string;
  pageContext?: string;
};

export function chatWithStaffOrPatient(context: ChatContext, messages: { role: "user" | "assistant"; content: string }[]) {
  const roleContext =
    context.role === "patient"
      ? "You are helping a dental patient with scheduling, billing, and general practice info only."
      : "You are helping dental clinic staff with practice operations.";

  return streamText({
    model: openai(DEFAULT_MODEL),
    system: `${SYSTEM_SAFETY}\n${roleContext}\nClinic: ${context.tenantName}\n${context.pageContext ?? ""}`,
    messages,
    maxTokens: 800,
  });
}
