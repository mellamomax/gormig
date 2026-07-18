export const EXPLAIN_LEVELS = ["3", "5", "10", "20", "expert"] as const;

export type ExplainLevel = (typeof EXPLAIN_LEVELS)[number];

export const DEFAULT_EXPLAIN_LEVEL: ExplainLevel = "10";

const EXPLAIN_LEVEL_LABELS: Record<ExplainLevel, string> = {
  "3": "3 år",
  "5": "5 år",
  "10": "10 år",
  "20": "20 år",
  expert: "Expert",
};

const EXPLAIN_LEVEL_PROMPTS: Record<ExplainLevel, string> = {
  "3": "Explain like the reader is 3 years old. Use tiny, concrete Swedish words. No jargon. One simple idea per field. Summary max 7 words. Thesis and signal reasoning max 12 words each. Arrays max 1 item.",
  "5": "Explain like the reader is 5 years old. Use very simple Swedish. Avoid finance jargon. Summary max 9 words. Thesis and signal reasoning max 14 words each. Arrays max 1 item.",
  "10": "Explain like the reader is 10 years old. Keep it short and plain. Explain only what matters. Summary max 12 words. Thesis and signal reasoning max 18 words each. Arrays max 2 short items.",
  "20": "Explain like the reader is 20 years old. Be concise and clear. Light investing terms are okay if useful. Summary max 16 words. Thesis and signal reasoning max 24 words each. Arrays max 2 items.",
  expert: "Explain for an investing expert. Be compact but precise. You may use valuation, catalyst, liquidity, dilution, and risk terms. Summary max 20 words. Thesis and signal reasoning max 35 words each. Arrays max 3 items.",
};

export function parseExplainLevel(value: string | null | undefined): ExplainLevel {
  return EXPLAIN_LEVELS.includes(value as ExplainLevel) ? (value as ExplainLevel) : DEFAULT_EXPLAIN_LEVEL;
}

export function getExplainLevelLabel(level: ExplainLevel) {
  return EXPLAIN_LEVEL_LABELS[level];
}

export function getExplainLevelPrompt(level: ExplainLevel) {
  return EXPLAIN_LEVEL_PROMPTS[level];
}
