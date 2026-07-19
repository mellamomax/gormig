import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StockTrackerPanel, type StockOption, type StockTraceRow } from "@/components/stock-tracker";
import { canUseDatabase, listStockHistory } from "@/lib/data";
import { normalizeSymbol } from "@/lib/jobs/outcomes";
import { fetchDailyPrices, hasMarketDataConfig, type DailyPrice } from "@/lib/market/alpha-vantage";
import { priceMoveSince } from "@/lib/market/performance";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Okänt fel";
}

function buildRows(history: Awaited<ReturnType<typeof listStockHistory>>, ticker: string, prices: DailyPrice[]): StockTraceRow[] {
  return history
    .map((mention) => {
      const post = mention.posts;
      const signal = mention.signals?.[0];
      const publishedAt = post?.published_at || post?.created_at || null;

      return {
        id: mention.id,
        postId: post?.id || null,
        ticker,
        companyName: mention.company_name,
        caption: post?.caption || post?.url || mention.company_name,
        publishedAt,
        action: signal?.action || null,
        risk: signal?.risk_level || null,
        confidence: signal?.confidence ?? null,
        thesis: mention.thesis,
        ...priceMoveSince(prices, publishedAt),
      };
    })
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
}

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  if (!canUseDatabase()) notFound();
  const { ticker } = await params;
  const decoded = decodeURIComponent(ticker);
  const history = await listStockHistory(decoded);
  const displayTicker = history.find((mention) => mention.ticker)?.ticker?.toUpperCase() || decoded.toUpperCase();
  const exchange = history.find((mention) => mention.ticker)?.exchange || null;
  const options: StockOption[] = [{ ticker: displayTicker, label: history[0]?.company_name || displayTicker, exchange, count: history.length }];
  let prices: DailyPrice[] = [];
  let marketError = "";

  if (hasMarketDataConfig() && displayTicker) {
    try {
      prices = await fetchDailyPrices(normalizeSymbol(displayTicker, exchange), "full");
    } catch (error) {
      marketError = getErrorMessage(error);
    }
  }
  const rows = buildRows(history, displayTicker, prices);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto grid max-w-5xl gap-5 px-5 py-6">
        <Link className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600" href="/">
          <ArrowLeft size={16} /> Till dashboard
        </Link>
        <header className="rounded border border-[var(--line)] bg-[var(--panel)] p-5">
          <p className="text-sm font-semibold uppercase text-[var(--accent)]">Aktiehistorik</p>
          <h1 className="mt-1 text-3xl font-bold">{decoded.toUpperCase()}</h1>
          <p className="mt-2 text-sm text-slate-600">Alla sparade videos där aktien eller bolaget nämnts, med förändring sedan publicering.</p>
        </header>

        <StockTrackerPanel options={options} selectedTicker={displayTicker} prices={prices} rows={rows} marketEnabled={hasMarketDataConfig()} marketError={marketError} />

      </div>
    </main>
  );
}
