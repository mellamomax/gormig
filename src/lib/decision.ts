import { addDays, inferHorizonDays, toDateOnly } from "@/lib/market/horizon";
import type { Mention, Signal } from "@/lib/types";

type DecisionInput = {
  mention: Mention;
  signal?: Signal;
  publishedAt: string | null;
  createdAt: string;
};

function formatShortDate(value: string | null) {
  if (!value) return "oklart datum";
  return new Intl.DateTimeFormat("sv-SE", { month: "short", day: "numeric" }).format(new Date(value));
}

function averageConfidence(mention: Mention, signal?: Signal) {
  return (Number(mention.confidence || 0) + Number(signal?.confidence || mention.confidence || 0)) / 2;
}

function horizonBucket(days: number | null) {
  if (days === null) return "oklar";
  if (days <= 1) return "timmar/dag";
  if (days <= 7) return "dagar";
  if (days <= 45) return "veckor";
  if (days <= 180) return "månader";
  return "lång sikt";
}

export function buildHorizonDecision(input: DecisionInput) {
  const horizonDays = inferHorizonDays(input.mention.time_horizon);
  const sourceDate = new Date(input.publishedAt || input.createdAt);
  const targetDate = horizonDays === null ? null : toDateOnly(addDays(sourceDate, horizonDays));
  const bucket = horizonBucket(horizonDays);
  const action = input.signal?.action || "INSUFFICIENT_DATA";
  const dateLabel = formatShortDate(targetDate);

  if (horizonDays === null) {
    return {
      horizonDays,
      targetDate,
      bucket,
      headline: "Tid oklar",
      detail: "Vänta med fiktiva pengar tills horisonten eller triggern är tydlig.",
      footnote: "Horisont = hur länge idén ska följas upp, inte automatiskt köptid.",
    };
  }

  if (action === "BUY_CANDIDATE") {
    return {
      horizonDays,
      targetDate,
      bucket,
      headline: `Gäller nu: ${bucket}`,
      detail: `Idén ska utvärderas senast ${dateLabel}. Det betyder inte att du ska vänta tills dess med entry.`,
      footnote: "Köp styrs av entry/trigger och risk, horisonten styr uppföljningen.",
    };
  }

  if (action === "WATCH") {
    return {
      horizonDays,
      targetDate,
      bucket,
      headline: `Bevaka: ${bucket}`,
      detail: `Ingen köp-action ännu. Vänta på trigger och följ upp senast ${dateLabel}.`,
      footnote: "Watch = observera, inte investera direkt.",
    };
  }

  if (action === "REDUCE" || action === "AVOID") {
    return {
      horizonDays,
      targetDate,
      bucket,
      headline: `Riskläge: ${bucket}`,
      detail: `Idén pekar mot försiktighet fram till ${dateLabel}.`,
      footnote: "Negativ signal betyder att fiktiva pengar normalt inte läggs.",
    };
  }

  return {
    horizonDays,
    targetDate,
    bucket,
    headline: `Följ: ${bucket}`,
    detail: `Utvärdera igen senast ${dateLabel}.`,
    footnote: "Horisonten är en kontrollpunkt för utfallet.",
  };
}

export function buildReliability(input: DecisionInput) {
  const confidence = averageConfidence(input.mention, input.signal);
  const hasTicker = Boolean(input.mention.ticker);
  const hasHorizon = inferHorizonDays(input.mention.time_horizon) !== null;
  const hasArguments = input.mention.arguments.length >= 2;
  const hasRisks = input.mention.risks.length > 0;
  const hasCatalyst = input.mention.catalysts.length > 0;

  let score = 1;
  if (hasTicker) score += 1;
  if (hasHorizon) score += 1;
  if (confidence >= 0.7 && hasArguments) score += 1;
  if (hasRisks || hasCatalyst) score += 1;

  return {
    score: Math.max(1, Math.min(5, score)),
    max: 5,
    label: score >= 5 ? "Starkt underlag" : score >= 4 ? "Bra underlag" : score >= 3 ? "Okej underlag" : "Svagt underlag",
    evidence: [
      hasTicker ? "Ticker identifierad" : "Ticker saknas",
      hasHorizon ? "Tidshorisont tolkad" : "Tidshorisont oklar",
      hasArguments ? "Argument finns" : "Få argument",
      hasRisks ? "Risker nämns" : "Risker saknas",
      hasCatalyst ? "Katalysator finns" : "Katalysator saknas",
    ],
    futureSources: ["prisdata", "nyheter", "rapportdata", "sentiment"],
  };
}

export function buildPositionSize(input: DecisionInput) {
  const reliability = buildReliability(input);
  const confidence = averageConfidence(input.mention, input.signal);
  const risk = input.signal?.risk_level || "unknown";
  const action = input.signal?.action || "INSUFFICIENT_DATA";
  const horizonKnown = inferHorizonDays(input.mention.time_horizon) !== null;

  if (action !== "BUY_CANDIDATE" || !horizonKnown) {
    return { label: "Ingen", percent: 0, detail: "Ingen fiktiv position innan köp-signal och horisont är tydlig.", tone: "neutral" as const };
  }

  if (risk === "high" || reliability.score <= 2 || confidence < 0.55) {
    return { label: "Test", percent: 2, detail: "Endast teststorlek: hög risk eller tunt underlag.", tone: "caution" as const };
  }

  if (risk === "medium" || reliability.score === 3 || confidence < 0.75) {
    return { label: "Liten", percent: 5, detail: "Liten fiktiv position tills mer bekräftelse finns.", tone: "caution" as const };
  }

  if (reliability.score === 4 || confidence < 0.9) {
    return { label: "Mellan", percent: 10, detail: "Normal fiktiv position för bra men inte fullständigt underlag.", tone: "good" as const };
  }

  if (risk === "low" && reliability.score === 5 && confidence >= 0.94) {
    return { label: "Max", percent: 20, detail: "Max i appen: stark signal, låg risk och hög confidence. Fortfarande inte all-in.", tone: "strong" as const };
  }

  return { label: "Hög", percent: 15, detail: "Hög fiktiv position. Max-läge kräver låg risk och ännu högre confidence.", tone: "strong" as const };
}
