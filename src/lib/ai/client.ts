import { createOpenAI } from "@ai-sdk/openai";

const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const openai = (model: string) => openaiProvider(model);

export const DEFAULT_MODEL = "gpt-4o-mini";

export const SYSTEM_SAFETY =
  "You are a dental practice assistant. Never provide medical diagnoses or treatment advice to patients. " +
  "For clinical tasks, structure information only — licensed dentists make all decisions. " +
  "If asked for medical advice, decline politely and suggest consulting their dentist.";
