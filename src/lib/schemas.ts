import { z } from "zod";

export const signalActionSchema = z.enum([
  "BUY_CANDIDATE",
  "WATCH",
  "HOLD",
  "REDUCE",
  "AVOID",
  "INSUFFICIENT_DATA",
]);

export const sentimentSchema = z.enum(["positive", "negative", "neutral"]);
export const riskLevelSchema = z.enum(["low", "medium", "high", "unknown"]);

export const analysisSummaryByLevelSchema = z.object({
  "3": z.string().min(1),
  "5": z.string().min(1),
  "10": z.string().min(1),
  "20": z.string().min(1),
  expert: z.string().min(1),
});

export const analysisSignalSchema = z.object({
  action: signalActionSchema,
  reasoning: z.string().min(12),
  entry_condition: z.string().nullable().optional(),
  invalidation_condition: z.string().nullable().optional(),
  risk_level: riskLevelSchema,
  confidence: z.number().min(0).max(1),
});

export const analysisMentionSchema = z.object({
  company_name: z.string().min(1),
  ticker: z.string().min(1).nullable().optional(),
  exchange: z.string().min(1).nullable().optional(),
  sentiment: sentimentSchema,
  thesis: z.string().min(10),
  arguments: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  catalysts: z.array(z.string()).default([]),
  mentioned_price: z.string().nullable().optional(),
  time_horizon: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  signal: analysisSignalSchema,
});

export const analysisResponseSchema = z.object({
  summary: z.string().min(1),
  headline: z.string().min(1).optional(),
  summary_by_level: analysisSummaryByLevelSchema.optional(),
  mentions: z.array(analysisMentionSchema),
  no_mention_reason: z.string().nullable().optional(),
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type AnalysisMention = z.infer<typeof analysisMentionSchema>;
export type SignalAction = z.infer<typeof signalActionSchema>;
