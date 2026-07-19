import { getEnv, requireEnv } from "@/lib/env";

export type DailyPrice = {
  date: string;
  close: number;
};

export type MarketNewsItem = {
  title: string;
  summary: string;
  url: string | null;
  source: string;
  publishedAt: string | null;
  sentimentLabel: string | null;
  sentimentScore: number | null;
};

function parseTimeSeries(payload: unknown): DailyPrice[] {
  const root = payload as Record<string, unknown>;
  const series = root["Time Series (Daily)"] as Record<string, Record<string, string>> | undefined;
  if (!series) {
    const note = typeof root.Note === "string" ? root.Note : typeof root.Information === "string" ? root.Information : "Unexpected Alpha Vantage response.";
    throw new Error(note);
  }

  return Object.entries(series)
    .map(([date, row]) => ({ date, close: Number(row["4. close"]) }))
    .filter((row) => Number.isFinite(row.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function hasMarketDataConfig() {
  return Boolean(getEnv("ALPHA_VANTAGE_API_KEY"));
}

async function requestDailyPrices(symbol: string, outputsize: "compact" | "full") {
  const apikey = requireEnv("ALPHA_VANTAGE_API_KEY");
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "TIME_SERIES_DAILY");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("outputsize", outputsize);
  url.searchParams.set("apikey", apikey);

  const response = await fetch(url, { next: { revalidate: 60 * 60 * 12 } });
  if (!response.ok) throw new Error(`Alpha Vantage failed with ${response.status}`);
  return parseTimeSeries(await response.json());
}

function isPremiumOutputSizeError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("outputsize=full") && error.message.toLowerCase().includes("premium");
}

export async function fetchDailyPrices(symbol: string, outputsize: "compact" | "full" = "compact") {
  try {
    return await requestDailyPrices(symbol, outputsize);
  } catch (error) {
    if (outputsize === "full" && isPremiumOutputSizeError(error)) {
      return requestDailyPrices(symbol, "compact");
    }
    throw error;
  }
}

export function findPriceOnOrAfter(prices: DailyPrice[], date: string) {
  return prices.find((price) => price.date >= date) || null;
}

function parseAlphaDate(value: unknown) {
  if (typeof value !== "string" || value.length < 8) return null;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11) || "00"}:${value.slice(11, 13) || "00"}:00.000Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function parseNewsSentiment(payload: unknown): MarketNewsItem[] {
  const root = payload as Record<string, unknown>;
  if (typeof root.Note === "string" || typeof root.Information === "string") {
    throw new Error((root.Note || root.Information) as string);
  }

  const feed = Array.isArray(root.feed) ? root.feed : [];
  return feed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!title) return [];

    const summary = typeof record.summary === "string" && record.summary.trim() ? record.summary.trim() : title;
    const url = typeof record.url === "string" && record.url.trim() ? record.url.trim() : null;
    const source = typeof record.source === "string" && record.source.trim() ? record.source.trim() : "Alpha Vantage";
    const sentimentScore = Number(record.overall_sentiment_score);

    return [{
      title,
      summary,
      url,
      source,
      publishedAt: parseAlphaDate(record.time_published),
      sentimentLabel: typeof record.overall_sentiment_label === "string" ? record.overall_sentiment_label : null,
      sentimentScore: Number.isFinite(sentimentScore) ? sentimentScore : null,
    }];
  });
}

export async function fetchMarketNews(symbol: string, limit = 3) {
  const apikey = requireEnv("ALPHA_VANTAGE_API_KEY");
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("tickers", symbol);
  url.searchParams.set("sort", "LATEST");
  url.searchParams.set("limit", String(Math.max(1, Math.min(limit, 10))));
  url.searchParams.set("apikey", apikey);

  const response = await fetch(url, { next: { revalidate: 60 * 30 } });
  if (!response.ok) throw new Error(`Alpha Vantage news failed with ${response.status}`);
  return parseNewsSentiment(await response.json());
}
