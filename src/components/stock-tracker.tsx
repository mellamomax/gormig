import Link from "next/link";
import { ArrowUpRight, LineChart, Search } from "lucide-react";
import type { DailyPrice } from "@/lib/market/alpha-vantage";
import { formatPercent, formatPrice, slicePricesForChart, type PriceMove } from "@/lib/market/performance";

export type StockOption = {
  ticker: string;
  label: string;
  exchange: string | null;
  count: number;
};

export type StockTraceRow = PriceMove & {
  id: string;
  postId: string | null;
  ticker: string;
  companyName: string;
  caption: string;
  publishedAt: string | null;
  action: string | null;
  risk: string | null;
  confidence: number | null;
  thesis: string;
};

type ChartMarker = {
  date: string;
  label: string;
};

function formatDate(value: string | null) {
  if (!value) return "Okänt";
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(value));
}

function actionLabel(action: string | null) {
  if (action === "BUY_CANDIDATE") return "Köp";
  if (action === "WATCH") return "Bevaka";
  if (action === "HOLD") return "Behåll";
  if (action === "REDUCE") return "Minska";
  if (action === "AVOID") return "Undvik";
  return "Oklar";
}

function changeTone(value: number | null) {
  if (value === null) return "text-slate-500";
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-red-600";
  return "text-slate-700";
}

function PriceLineChart({ prices, markers = [], compact = false }: { prices: DailyPrice[]; markers?: ChartMarker[]; compact?: boolean }) {
  const firstMarkerDate = markers.map((marker) => marker.date.slice(0, 10)).filter(Boolean).sort()[0];
  const chartPrices = slicePricesForChart(prices, firstMarkerDate, compact ? 55 : 150);
  if (chartPrices.length < 2) {
    return (
      <div className={`grid place-items-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel-2)] text-sm text-slate-500 ${compact ? "h-32" : "h-56"}`}>
        Ingen kursgraf ännu
      </div>
    );
  }

  const width = 720;
  const height = compact ? 150 : 230;
  const padX = 18;
  const padY = 16;
  const min = Math.min(...chartPrices.map((price) => price.close));
  const max = Math.max(...chartPrices.map((price) => price.close));
  const range = max - min || 1;
  const bottom = height - padY;
  const top = padY;
  const innerWidth = width - padX * 2;
  const innerHeight = bottom - top;
  const xFor = (index: number) => padX + (index / Math.max(1, chartPrices.length - 1)) * innerWidth;
  const yFor = (value: number) => bottom - ((value - min) / range) * innerHeight;
  const points = chartPrices.map((price, index) => `${xFor(index).toFixed(2)},${yFor(price.close).toFixed(2)}`).join(" ");
  const area = `${padX},${bottom} ${points} ${width - padX},${bottom}`;
  const markerPoints = markers.flatMap((marker) => {
    const index = chartPrices.findIndex((price) => price.date >= marker.date.slice(0, 10));
    if (index < 0) return [];
    const price = chartPrices[index];
    return [{ ...marker, x: xFor(index), y: yFor(price.close) }];
  });

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
      <svg className="block h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Aktiekurs">
        <defs>
          <linearGradient id={`stock-fill-${compact ? "mini" : "full"}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0b8f7a" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0b8f7a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((line) => (
          <line key={line} x1={padX} x2={width - padX} y1={top + innerHeight * line} y2={top + innerHeight * line} stroke="#d5e0dc" strokeDasharray="4 6" />
        ))}
        <polygon fill={`url(#stock-fill-${compact ? "mini" : "full"})`} points={area} />
        <polyline fill="none" points={points} stroke="#0b8f7a" strokeLinecap="round" strokeLinejoin="round" strokeWidth={compact ? 4 : 5} />
        {markerPoints.map((marker) => (
          <g key={`${marker.date}-${marker.label}`}>
            <line x1={marker.x} x2={marker.x} y1={top} y2={bottom} stroke="#e56b2f" strokeDasharray="5 5" strokeWidth="2" />
            <circle cx={marker.x} cy={marker.y} fill="#e56b2f" r={compact ? 5 : 7} stroke="white" strokeWidth="3" />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function StockTrackerPanel({
  options,
  selectedTicker,
  prices,
  rows,
  marketEnabled,
  marketError,
}: {
  options: StockOption[];
  selectedTicker: string;
  prices: DailyPrice[];
  rows: StockTraceRow[];
  marketEnabled: boolean;
  marketError: string;
}) {
  const selected = options.find((option) => option.ticker === selectedTicker);
  const latest = prices.length ? prices[prices.length - 1] : null;
  const firstRow = rows[0];

  return (
    <section className="stock-tracker grid gap-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--accent)]"><LineChart size={15} /> Aktie</p>
              <h2 className="mt-1 text-3xl font-black">{selectedTicker || "Ingen aktie"}</h2>
              <p className="mt-1 text-sm text-slate-600">{selected?.label || "Välj en ticker från analyserna"}</p>
            </div>
            <form className="flex items-center gap-2" action="/">
              <input type="hidden" name="tab" value="stocks" />
              <select className="h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold" name="ticker" defaultValue={selectedTicker}>
                {options.map((option) => (
                  <option key={option.ticker} value={option.ticker}>
                    {option.ticker} ({option.count})
                  </option>
                ))}
              </select>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--foreground)] px-3 text-sm font-bold text-white" type="submit">
                <Search size={15} /> Visa
              </button>
            </form>
          </div>

          <div className="mt-4">
            <PriceLineChart prices={prices} markers={rows.map((row) => ({ date: row.publishedAt || "", label: row.ticker })).filter((marker) => marker.date)} />
          </div>

          {marketError ? <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{marketError}</p> : null}
          {!marketEnabled ? <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Lägg in ALPHA_VANTAGE_API_KEY för att visa kursdata.</p> : null}
        </article>

        <aside className="grid content-start gap-3">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Senaste kurs</p>
            <p className="mt-2 text-3xl font-black">{formatPrice(latest?.close ?? null)}</p>
            <p className="mt-1 text-sm text-slate-500">{formatDate(latest?.date ?? null)}</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Sedan senaste video</p>
            <p className={`mt-2 text-3xl font-black ${changeTone(firstRow?.changePct ?? null)}`}>{formatPercent(firstRow?.changePct ?? null)}</p>
            <p className="mt-1 text-sm text-slate-500">{firstRow ? formatDate(firstRow.publishedAt) : "Ingen video"}</p>
          </div>
        </aside>
      </div>

      <article className="rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-sm">
        <div className="grid grid-cols-[7rem_8rem_1fr_8rem_7rem] gap-3 border-b border-[var(--line)] bg-[var(--panel-2)] px-4 py-3 text-xs font-bold uppercase text-slate-500 stock-row-head">
          <span>Datum</span>
          <span>Signal</span>
          <span>Analys</span>
          <span>Förändring</span>
          <span>Pris</span>
        </div>
        {rows.length === 0 ? <p className="p-4 text-sm text-slate-600">Inga analyser med den aktien ännu.</p> : null}
        {rows.map((row) => (
          <Link
            key={row.id}
            className="grid grid-cols-[7rem_8rem_1fr_8rem_7rem] gap-3 border-b border-[var(--line)] px-4 py-3 text-sm last:border-b-0 hover:bg-[var(--panel-2)] stock-row"
            href={row.postId ? `/posts/${row.postId}` : "#"}
          >
            <span className="text-slate-600">{formatDate(row.publishedAt)}</span>
            <span className="font-black">{actionLabel(row.action)}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{row.caption}</span>
              <span className="block truncate text-xs text-slate-500">{row.thesis}</span>
            </span>
            <span className={`font-black ${changeTone(row.changePct)}`}>{formatPercent(row.changePct)}</span>
            <span className="text-slate-600">{formatPrice(row.startPrice)} → {formatPrice(row.latestPrice)}</span>
          </Link>
        ))}
      </article>
    </section>
  );
}

export function MentionStockTrace({
  ticker,
  companyName,
  publishedAt,
  prices,
  move,
  marketEnabled,
  marketError,
}: {
  ticker: string;
  companyName: string;
  publishedAt: string | null;
  prices: DailyPrice[];
  move: PriceMove;
  marketEnabled: boolean;
  marketError?: string;
}) {
  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3 md:grid-cols-[minmax(0,1fr)_12rem]">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-black">{ticker} sedan videon</p>
          <Link className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]" href={`/stocks/${encodeURIComponent(ticker)}`}>
            Full historik <ArrowUpRight size={13} />
          </Link>
        </div>
        <PriceLineChart compact prices={prices} markers={publishedAt ? [{ date: publishedAt, label: ticker }] : []} />
      </div>
      <div className="grid content-center gap-2">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">{companyName}</p>
          <p className={`mt-1 text-3xl font-black ${changeTone(move.changePct)}`}>{formatPercent(move.changePct)}</p>
        </div>
        <p className="text-sm text-slate-600">{formatPrice(move.startPrice)} → {formatPrice(move.latestPrice)}</p>
        <p className="text-xs text-slate-500">{formatDate(move.startDate)} till {formatDate(move.latestDate)}</p>
        {!marketEnabled ? <p className="text-xs text-amber-700">Market data saknas.</p> : null}
        {marketError ? <p className="line-clamp-2 text-xs text-amber-700">{marketError}</p> : null}
      </div>
    </div>
  );
}
