import { createHash } from "crypto";
import { listSignalsForOutcomeUpdate, upsertFollowUpEvent, writeRunLog } from "@/lib/data";
import { getEnv } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors";
import { fetchDailyPrices, fetchMarketNews, findPriceOnOrAfter, hasMarketDataConfig } from "@/lib/market/alpha-vantage";
import { toDateOnly } from "@/lib/market/horizon";
import { normalizeSymbol, updateOutcomeEvaluations } from "@/lib/jobs/outcomes";
import type { FollowUpEvent, Signal } from "@/lib/types";

const PRICE_MOVE_THRESHOLD_PCT = 3;
const DEFAULT_MAX_SYMBOLS_PER_RUN = 2;

function hashKey(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 24);
}

function severityForMove(returnPct: number): FollowUpEvent["severity"] {
  const abs = Math.abs(returnPct);
  if (abs >= 8) return "important";
  if (abs >= PRICE_MOVE_THRESHOLD_PCT) return "watch";
  return "info";
}

function shortSummary(value: string, maxLength = 220) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 3)}...` : clean;
}

function actionDirection(signal: Signal) {
  if (signal.action === "BUY_CANDIDATE" || signal.action === "WATCH" || signal.action === "HOLD") return "upp";
  if (signal.action === "REDUCE" || signal.action === "AVOID") return "ned";
  return "oklart";
}

export async function runAutomaticFollowUps() {
  if (!hasMarketDataConfig()) {
    throw new Error("ALPHA_VANTAGE_API_KEY saknas. Lägg till den i Vercel för automatiska uppföljningar.");
  }

  const maxSymbols = Number(getEnv("FOLLOW_UP_MAX_SYMBOLS") || DEFAULT_MAX_SYMBOLS_PER_RUN);
  const safeMaxSymbols = Number.isFinite(maxSymbols) ? Math.max(1, Math.min(maxSymbols, 8)) : DEFAULT_MAX_SYMBOLS_PER_RUN;
  const outcomeReport = await updateOutcomeEvaluations(undefined, safeMaxSymbols);
  const signals = await listSignalsForOutcomeUpdate();
  const report = {
    checked: signals.length,
    maxSymbols: safeMaxSymbols,
    outcomeReport,
    priceEvents: 0,
    newsEvents: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };

  const priceCache = new Map<string, Awaited<ReturnType<typeof fetchDailyPrices>>>();
  const newsCache = new Map<string, Awaited<ReturnType<typeof fetchMarketNews>>>();
  const seenSymbols = new Set<string>();

  for (const signal of signals) {
    const mention = signal.mentions;
    const post = mention?.posts;
    if (!mention?.ticker || !post) {
      report.skipped += 1;
      continue;
    }

    const symbol = normalizeSymbol(mention.ticker, mention.exchange);
    if (seenSymbols.size >= safeMaxSymbols && !seenSymbols.has(symbol)) {
      report.skipped += 1;
      continue;
    }
    seenSymbols.add(symbol);

    try {
      if (!priceCache.has(symbol)) priceCache.set(symbol, await fetchDailyPrices(symbol));
      const prices = priceCache.get(symbol) || [];
      const sourceDate = toDateOnly(new Date(post.published_at || post.created_at));
      const start = findPriceOnOrAfter(prices, sourceDate);
      const latest = prices.at(-1) || null;

      if (start && latest && latest.date > start.date) {
        const returnPct = ((latest.close - start.close) / start.close) * 100;
        if (Math.abs(returnPct) >= PRICE_MOVE_THRESHOLD_PCT) {
          const title = `${mention.ticker} ${returnPct >= 0 ? "upp" : "ned"} ${Math.abs(returnPct).toFixed(1)}% sedan analysen`;
          const created = await upsertFollowUpEvent({
            signal_id: signal.id,
            mention_id: mention.id,
            post_id: post.id,
            ticker: mention.ticker,
            company_name: mention.company_name,
            event_type: "price_move",
            severity: severityForMove(returnPct),
            title,
            summary: `Analysen väntade ${actionDirection(signal)}. Priset gick från ${start.close} till ${latest.close} mellan ${start.date} och ${latest.date}.`,
            source: "alpha_vantage",
            source_url: null,
            observed_at: `${latest.date}T12:00:00.000Z`,
            unique_event_key: `price:${signal.id}:${latest.date}:${Math.round(returnPct * 10)}`,
            raw_data: { symbol, returnPct, start, latest, action: signal.action },
          });
          if (created) report.priceEvents += 1;
        }
      }

      if (!newsCache.has(symbol)) newsCache.set(symbol, await fetchMarketNews(symbol, 2));
      const news = newsCache.get(symbol) || [];
      for (const item of news) {
        const created = await upsertFollowUpEvent({
          signal_id: signal.id,
          mention_id: mention.id,
          post_id: post.id,
          ticker: mention.ticker,
          company_name: mention.company_name,
          event_type: "news",
          severity: item.sentimentScore !== null && Math.abs(item.sentimentScore) >= 0.25 ? "watch" : "info",
          title: item.title,
          summary: shortSummary(item.summary),
          source: item.source,
          source_url: item.url,
          observed_at: item.publishedAt || new Date().toISOString(),
          unique_event_key: `news:${symbol}:${hashKey(item.url || item.title)}`,
          raw_data: { symbol, sentimentLabel: item.sentimentLabel, sentimentScore: item.sentimentScore },
        });
        if (created) report.newsEvents += 1;
      }
    } catch (error) {
      report.failed += 1;
      report.errors.push(`${symbol}: ${getErrorMessage(error)}`);
    }
  }

  await writeRunLog("cron", report.failed ? "failed" : "completed", { followUps: report });
  return report;
}
