import { DEFAULT_EXPLAIN_LEVEL, EXPLAIN_LEVELS, type ExplainLevel } from "@/lib/explain-level";
import type { DashboardPost, Mention, Signal } from "@/lib/types";

export type SummaryMap = Record<ExplainLevel, string>;

type MentionWithSignals = Mention & { signals?: Signal[] };

function isSummaryMap(value: unknown): value is Partial<SummaryMap> {
  return Boolean(value && typeof value === "object");
}

function trimSentence(value: string | null | undefined, maxLength = 90) {
  const clean = (value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength - 1).trim();
  return `${sliced}...`;
}

export function getPrimaryMention(post: DashboardPost): MentionWithSignals | undefined {
  return post.mentions?.[0];
}

export function getPrimarySignal(post: DashboardPost): Signal | undefined {
  return getPrimaryMention(post)?.signals?.[0];
}

export function getMentionedStockLabel(post: DashboardPost) {
  const mention = getPrimaryMention(post);
  return mention?.ticker || mention?.company_name || "-";
}

export function getCategoryLabel(post: DashboardPost) {
  return getPrimarySignal(post)?.action || post.processing_status;
}

export function getSummaryFallback(post: DashboardPost) {
  const mention = getPrimaryMention(post);
  return trimSentence(mention?.thesis || post.caption || post.transcript || "Ingen summering ännu.");
}

export function getSummaryMap(post: DashboardPost): SummaryMap {
  const raw = post.raw_metadata || {};
  const stored = isSummaryMap(raw.analysis_summary_by_level) ? raw.analysis_summary_by_level : {};
  const fallback = trimSentence(String(raw.analysis_summary || getSummaryFallback(post)));

  return Object.fromEntries(
    EXPLAIN_LEVELS.map((level) => [level, trimSentence(stored[level] || fallback, level === "expert" ? 130 : 95)]),
  ) as SummaryMap;
}

export function getHeadline(post: DashboardPost) {
  const rawHeadline = post.raw_metadata?.analysis_headline;
  if (typeof rawHeadline === "string" && rawHeadline.trim()) return trimSentence(rawHeadline, 55);

  const mention = getPrimaryMention(post);
  if (mention?.company_name && mention.thesis) {
    const thesis = trimSentence(mention.thesis, 34).replace(/[.!?]$/, "");
    return `${mention.company_name}: ${thesis}`;
  }

  return trimSentence(post.caption || "Analys saknas", 55);
}

export function defaultSummary(summaryMap: SummaryMap) {
  return summaryMap[DEFAULT_EXPLAIN_LEVEL] || summaryMap["10"] || Object.values(summaryMap)[0] || "Ingen summering ännu.";
}
