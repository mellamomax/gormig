import OpenAI from "openai";
import { getEnv, requireEnv } from "@/lib/env";

let client: OpenAI | null = null;

export function hasOpenAIConfig() {
  return Boolean(getEnv("OPENAI_API_KEY"));
}

export function getOpenAIClient() {
  if (!client) {
    client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }
  return client;
}

export function getAnalysisModel() {
  return getEnv("OPENAI_ANALYSIS_MODEL") || "gpt-4o-mini";
}

export function getTranscribeModel() {
  return getEnv("OPENAI_TRANSCRIBE_MODEL") || "gpt-4o-mini-transcribe";
}
