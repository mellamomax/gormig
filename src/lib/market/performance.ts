import type { DailyPrice } from "@/lib/market/alpha-vantage";

export type PriceMove = {
  startPrice: number | null;
  latestPrice: number | null;
  startDate: string | null;
  latestDate: string | null;
  changePct: number | null;
};

export function latestPrice(prices: DailyPrice[]) {
  return prices.length ? prices[prices.length - 1] : null;
}

export function priceOnOrAfter(prices: DailyPrice[], date: string | null | undefined) {
  if (!date) return null;
  const dateOnly = date.slice(0, 10);
  return prices.find((price) => price.date >= dateOnly) || null;
}

export function priceMoveSince(prices: DailyPrice[], date: string | null | undefined): PriceMove {
  const start = priceOnOrAfter(prices, date);
  const latest = latestPrice(prices);
  const changePct = start && latest && start.close !== 0 ? ((latest.close - start.close) / start.close) * 100 : null;

  return {
    startPrice: start?.close ?? null,
    latestPrice: latest?.close ?? null,
    startDate: start?.date ?? null,
    latestDate: latest?.date ?? null,
    changePct,
  };
}

export function slicePricesForChart(prices: DailyPrice[], since?: string | null, maxPoints = 90) {
  const dateOnly = since?.slice(0, 10);
  const filtered = dateOnly ? prices.filter((price) => price.date >= dateOnly) : prices;
  const source = filtered.length >= 2 ? filtered : prices;
  if (source.length <= maxPoints) return source;

  const step = Math.ceil(source.length / maxPoints);
  const sampled = source.filter((_, index) => index % step === 0);
  const last = source[source.length - 1];
  return sampled[sampled.length - 1]?.date === last.date ? sampled : [...sampled, last];
}

export function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

export function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return value >= 100 ? value.toFixed(1) : value.toFixed(2);
}
