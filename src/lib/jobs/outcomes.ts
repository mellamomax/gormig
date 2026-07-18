import { listSignalsForOutcomeUpdate, upsertOutcomeEvaluation, writeRunLog } from "@/lib/data";
import { getErrorMessage } from "@/lib/errors";
import { fetchDailyPrices, findPriceOnOrAfter, hasMarketDataConfig } from "@/lib/market/alpha-vantage";
import { addDays, inferHorizonDays, toDateOnly } from "@/lib/market/horizon";
import type { OutcomeEvaluation, SignalAction } from "@/lib/types";

function normalizeSymbol(ticker: string, exchange?: string | null) {
  const cleanTicker = ticker.trim().toUpperCase();
  const cleanExchange = (exchange || "").trim().toUpperCase();
  if (!cleanExchange) return cleanTicker;
  if (cleanTicker.includes(".")) return cleanTicker;

  const suffixMap: Record<string, string> = {
    STO: "STO",
    STOCKHOLM: "STO",
    OMX: "STO",
    NASDAQ: "",
    NYSE: "",
    AMEX: "",
    LSE: "LON",
    LONDON: "LON",
    XETRA: "DEX",
    FRANKFURT: "DEX",
    TSX: "TRT",
  };

  const suffix = suffixMap[cleanExchange];
  return suffix ? `${cleanTicker}.${suffix}` : cleanTicker;
}

function classifyOutcome(action: SignalAction, returnPct: number) {
  if (action === "BUY_CANDIDATE" || action === "WATCH") {
    return returnPct > 0
      ? { isSuccess: true, verdict: "POSITIVE_HIT" as const }
      : { isSuccess: false, verdict: "MISS" as const };
  }

  if (action === "REDUCE" || action === "AVOID") {
    return returnPct <= 0
      ? { isSuccess: true, verdict: "NEGATIVE_HIT" as const }
      : { isSuccess: false, verdict: "MISS" as const };
  }

  if (action === "HOLD") {
    return Math.abs(returnPct) <= 5
      ? { isSuccess: true, verdict: "NEUTRAL_HIT" as const }
      : { isSuccess: false, verdict: "MISS" as const };
  }

  return { isSuccess: null, verdict: "IGNORED" as const };
}

export async function updateOutcomeEvaluations(postId?: string) {
  if (!hasMarketDataConfig()) {
    throw new Error("ALPHA_VANTAGE_API_KEY saknas. Lägg till den i Vercel för automatisk kursuppföljning.");
  }

  const signals = await listSignalsForOutcomeUpdate(postId);
  const report = { checked: signals.length, updated: 0, pending: 0, skipped: 0, noData: 0, failed: 0, errors: [] as string[] };
  const priceCache = new Map<string, Awaited<ReturnType<typeof fetchDailyPrices>>>();

  for (const signal of signals) {
    try {
      const mention = signal.mentions;
      const post = mention?.posts;
      const sourceDate = post?.published_at || post?.created_at;
      if (!mention?.ticker || !sourceDate || !post) continue;

      const usedCreatedDate = !post.published_at;
      const dateNote = usedCreatedDate ? " Skapandedatum användes eftersom publiceringsdatum saknas." : "";
      const horizonDays = inferHorizonDays(mention.time_horizon);
      const startDate = new Date(sourceDate);
      const startDateOnly = toDateOnly(startDate);
      const symbol = normalizeSymbol(mention.ticker, mention.exchange);

      if (horizonDays === null) {
        await upsertOutcomeEvaluation({
          signal_id: signal.id,
          mention_id: mention.id,
          post_id: post.id,
          ticker: mention.ticker,
          exchange: mention.exchange,
          action: signal.action,
          horizon_label: mention.time_horizon,
          horizon_days: null,
          start_date: startDateOnly,
          target_date: null,
          start_price: null,
          target_price: null,
          return_pct: null,
          is_success: null,
          verdict: "IGNORED",
          notes: `Ingen bedömbar tidshorisont hittades i videon. Uppföljning kräver en tidsram som sägs eller tydligt antyds.${dateNote}`,
          source: "analysis",
          raw_data: { symbol, reason: "missing_or_unclear_horizon", usedCreatedDate },
        });
        report.skipped += 1;
        continue;
      }

      const targetDate = addDays(startDate, horizonDays);
      const targetDateOnly = toDateOnly(targetDate);
      const nowDateOnly = toDateOnly(new Date());

      if (targetDateOnly > nowDateOnly) {
        await upsertOutcomeEvaluation({
          signal_id: signal.id,
          mention_id: mention.id,
          post_id: post.id,
          ticker: mention.ticker,
          exchange: mention.exchange,
          action: signal.action,
          horizon_label: mention.time_horizon,
          horizon_days: horizonDays,
          start_date: startDateOnly,
          target_date: targetDateOnly,
          start_price: null,
          target_price: null,
          return_pct: null,
          is_success: null,
          verdict: "PENDING",
          notes: `Uppföljningsdatumet ${targetDateOnly} har inte passerat ännu.${dateNote}`,
          source: "alpha_vantage",
          raw_data: { symbol, usedCreatedDate },
        });
        report.pending += 1;
        continue;
      }

      if (!priceCache.has(symbol)) priceCache.set(symbol, await fetchDailyPrices(symbol));
      const prices = priceCache.get(symbol) || [];
      const start = findPriceOnOrAfter(prices, startDateOnly);
      const end = findPriceOnOrAfter(prices, targetDateOnly);

      if (!start || !end) {
        await upsertOutcomeEvaluation({
          signal_id: signal.id,
          mention_id: mention.id,
          post_id: post.id,
          ticker: mention.ticker,
          exchange: mention.exchange,
          action: signal.action,
          horizon_label: mention.time_horizon,
          horizon_days: horizonDays,
          start_date: startDateOnly,
          target_date: targetDateOnly,
          start_price: start?.close || null,
          target_price: end?.close || null,
          return_pct: null,
          is_success: null,
          verdict: "NO_DATA",
          notes: `Kunde inte hitta start- eller målpris i marknadsdatat.${dateNote}`,
          source: "alpha_vantage",
          raw_data: { symbol, availablePrices: prices.length, usedCreatedDate },
        });
        report.noData += 1;
        continue;
      }

      const returnPct = ((end.close - start.close) / start.close) * 100;
      const classified = classifyOutcome(signal.action, returnPct);

      await upsertOutcomeEvaluation({
        signal_id: signal.id,
        mention_id: mention.id,
        post_id: post.id,
        ticker: mention.ticker,
        exchange: mention.exchange,
        action: signal.action,
        horizon_label: mention.time_horizon,
        horizon_days: horizonDays,
        start_date: start.date,
        target_date: end.date,
        start_price: start.close,
        target_price: end.close,
        return_pct: returnPct,
        is_success: classified.isSuccess,
        verdict: classified.verdict,
        notes: `Kursrörelse ${returnPct.toFixed(2)}% från ${start.date} till ${end.date}.${dateNote}`,
        source: "alpha_vantage",
        raw_data: { symbol, usedCreatedDate },
      });
      report.updated += 1;
    } catch (error) {
      report.failed += 1;
      report.errors.push(getErrorMessage(error));
    }
  }

  await writeRunLog("manual_analysis", report.failed ? "failed" : "completed", { outcomeUpdate: report });
  return report;
}
