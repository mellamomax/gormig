import { PauseCircle, PlayCircle, WalletCards } from "lucide-react";
import { togglePaperTradingAction } from "@/app/actions";
import type { getPaperTradingOverview } from "@/lib/data";

type PaperOverview = Awaited<ReturnType<typeof getPaperTradingOverview>>;

function money(value: number) {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(value);
}

function percent(value: number | null) {
  if (value === null) return "-";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

export function PaperTradingPanel({ overview, compact = false }: { overview: PaperOverview; compact?: boolean }) {
  const enabled = overview.settings.enabled;

  return (
    <section className="rounded border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><WalletCards size={16} /> Paper trading</div>
          <p className={`mt-1 font-semibold ${enabled ? "text-emerald-700" : "text-slate-500"}`}>{enabled ? "Aktiv från nu" : "Avstängd"}</p>
        </div>
        <form action={togglePaperTradingAction}>
          <input type="hidden" name="enabled" value={enabled ? "no" : "yes"} />
          <button className={`inline-flex h-10 items-center gap-2 rounded px-3 text-sm font-semibold text-white ${enabled ? "bg-slate-700" : "bg-[var(--accent)]"}`} type="submit">
            {enabled ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
            {enabled ? "Pausa" : "Aktivera"}
          </button>
        </form>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "grid-cols-2" : "sm:grid-cols-4"}`}>
        <Metric label="Kapital" value={money(Number(overview.settings.starting_cash || 0))} />
        <Metric label="Allokerat" value={money(overview.activeAllocated)} />
        <Metric label="Resultat" value={money(overview.realizedPnl)} tone={overview.realizedPnl >= 0 ? "good" : "bad"} />
        <Metric label="Träff" value={percent(overview.hitRate)} />
      </div>

      {!compact && overview.trades.length ? (
        <div className="mt-4 overflow-x-auto rounded border border-[var(--line)]">
          <div className="grid min-w-[42rem] grid-cols-[7rem_1fr_7rem_7rem] gap-3 bg-[var(--panel-2)] px-3 py-2 text-xs font-semibold uppercase text-slate-500">
            <span>Aktie</span><span>Förväntan</span><span>Horisont</span><span>Belopp</span>
          </div>
          {overview.trades.slice(0, 12).map((trade) => (
            <div key={trade.id} className="grid min-w-[42rem] grid-cols-[7rem_1fr_7rem_7rem] gap-3 border-t border-[var(--line)] px-3 py-2 text-sm">
              <span className="font-semibold">{trade.ticker}</span>
              <span className="truncate text-slate-700">{trade.expectation || trade.thesis || "-"}</span>
              <span className="truncate text-slate-600">{trade.horizon_label || "oklar"}</span>
              <span className="text-slate-700">{money(Number(trade.allocated_cash || 0))}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-[var(--foreground)]";
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}