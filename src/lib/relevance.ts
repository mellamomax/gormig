import type { SourcePost } from "@/lib/types";

const FINANCE_HINTS = [
  "$",
  "aktie",
  "aktier",
  "aktien",
  "avanza",
  "bolag",
  "bors",
  "börs",
  "börsen",
  "finans",
  "fond",
  "fonder",
  "index",
  "invest",
  "investera",
  "krypto",
  "marknad",
  "nasdaq",
  "nordnet",
  "omx",
  "portfolj",
  "portfölj",
  "rapport",
  "ranta",
  "ränta",
  "stock",
  "trading",
  "utdelning",
];

const INVESTMENT_ANALYSIS_HINTS = [
  "analys",
  "buy",
  "catalyst",
  "ebit",
  "entry",
  "kop",
  "köp",
  "kurs",
  "marginal",
  "overvarderad",
  "övervärderad",
  "pe-tal",
  "position",
  "riktkurs",
  "risk",
  "salj",
  "sälj",
  "trigger",
  "tillvaxt",
  "tillväxt",
  "undervarderad",
  "undervärderad",
  "vinst",
  "vardering",
  "värdering",
];

const PROMO_OR_PINNED_HINTS = [
  "ekonomibyran",
  "ekonomibyrån",
  "gast",
  "gästar",
  "medlemmar",
  "nyhetsmorgon",
  "patreon",
  "storsta pa patreon",
  "största på patreon",
  "svt",
  "tackar",
  "tv4",
  "utsedd",
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function textIncludesAny(text: string, terms: string[]) {
  const normalized = normalizeText(text);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function hasPinnedFlag(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasPinnedFlag);

  const record = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(record)) {
    const normalizedKey = normalizeText(key);
    if ((normalizedKey.includes("pinned") || normalizedKey.includes("is_pinned")) && item === true) return true;
    if (item && typeof item === "object" && hasPinnedFlag(item)) return true;
  }

  return false;
}

export function classifySourcePost(post: Pick<SourcePost, "caption" | "rawMetadata">) {
  const text = post.caption || "";

  if (hasPinnedFlag(post.rawMetadata)) {
    return { shouldImport: false, reason: "pinned_video" };
  }

  if (text.trim().length === 0) {
    return { shouldImport: true, reason: null };
  }

  const hasFinanceHint = textIncludesAny(text, FINANCE_HINTS);
  const hasAnalysisHint = textIncludesAny(text, INVESTMENT_ANALYSIS_HINTS) || /[$#][a-z]{1,6}\b/i.test(text);
  const looksPromoOnly = textIncludesAny(text, PROMO_OR_PINNED_HINTS) && !hasAnalysisHint;

  if (looksPromoOnly) {
    return { shouldImport: false, reason: "promo_or_pinned_context" };
  }

  if (!hasFinanceHint) {
    return { shouldImport: false, reason: "no_finance_context" };
  }

  return { shouldImport: true, reason: null };
}
