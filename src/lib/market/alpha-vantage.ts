import { getEnv, requireEnv } from "@/lib/env";

export type DailyPrice = {
  date: string;
  close: number;
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

export async function fetchDailyPrices(symbol: string) {
  const apikey = requireEnv("ALPHA_VANTAGE_API_KEY");
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "TIME_SERIES_DAILY");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("outputsize", "compact");
  url.searchParams.set("apikey", apikey);

  const response = await fetch(url, { next: { revalidate: 60 * 60 * 12 } });
  if (!response.ok) throw new Error(`Alpha Vantage failed with ${response.status}`);
  return parseTimeSeries(await response.json());
}

export function findPriceOnOrAfter(prices: DailyPrice[], date: string) {
  return prices.find((price) => price.date >= date) || null;
}
