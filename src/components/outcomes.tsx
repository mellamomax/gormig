import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { updateOutcomesAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import type { Mention, OutcomeEvaluation, Post, Signal } from "@/lib/types";

function formatPct(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(1)}%`;
}

function verdictLabel(verdict: OutcomeEvaluation["verdict"]) {
  const labels = {
    PENDING: "Väntar",
    NO_DATA: "Ingen data",
    POSITIVE_HIT: "Träff upp",
    NEGATIVE_HIT: "Träff ned",
    NEUTRAL_HIT: "Träff neutral",
    MISS: "Miss",
    IGNORED: "Ignorerad",
  } satisfies Record<OutcomeEvaluation["verdict"], string>;
  return labels[verdict];
}

export function OutcomeUpdateForm({ postId }: { postId?: string }) {
  return (
    <form action={updateOutcomesAction}>
      {postId ? <input type="hidden" name="postId" value={postId} /> : null}
      <SubmitButton label={postId ? "Uppdatera" : "Uppdatera utfall"} pendingLabel="Hämtar data..." tone="accent" />
    </form>
  );
}

export function OutcomeList({ outcomes }: { outcomes: Array<OutcomeEvaluation & { signals?: Signal; mentions?: Mention; posts?: Post }> }) {
  if (outcomes.length === 0) {
    return (
      <section className="rounded border border-dashed border-[var(--line)] bg-[var(--panel)] p-5 text-sm text-slate-600">
        Ingen uppföljning ännu.
      </section>
    );
  }

  return (
    <section className="overflow-x-auto rounded border border-[var(--line)] bg-[var(--panel)]">
      <div className="grid min-w-[44rem] grid-cols-[1fr_7rem_8rem_7rem_8rem] gap-3 border-b border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-xs font-semibold uppercase text-slate-500">
        <span>Signal</span><span>Resultat</span><span>Period</span><span>Avkastning</span><span>Pris</span>
      </div>
      {outcomes.slice(0, 20).map((outcome) => (
        <article key={outcome.id} className="grid min-w-[44rem] grid-cols-[1fr_7rem_8rem_7rem_8rem] gap-3 border-b border-[var(--line)] px-3 py-2 text-sm last:border-b-0">
          <div className="min-w-0">
            <Link className="font-semibold hover:text-[var(--accent)]" href={`/posts/${outcome.post_id}`}>
              {outcome.ticker} · {outcome.action}
            </Link>
            <p className="truncate text-xs text-slate-500">{outcome.mentions?.company_name || outcome.posts?.caption || "Analys"}</p>
          </div>
          <div className={outcome.is_success ? "font-semibold text-emerald-700" : outcome.is_success === false ? "font-semibold text-red-700" : "font-semibold text-slate-600"}>{verdictLabel(outcome.verdict)}</div>
          <div className="truncate text-slate-600">{outcome.start_date || "-"} → {outcome.target_date || "-"}</div>
          <div className={Number(outcome.return_pct || 0) >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{formatPct(outcome.return_pct)}</div>
          <div className="truncate text-slate-600">{outcome.start_price || "-"} → {outcome.target_price || "-"}</div>
        </article>
      ))}
    </section>
  );
}

export function AccuracySummary({ stats }: { stats: { completed: number; hitRate: number | null; averageReturn: number; pending: number; noData: number } }) {
  return (
    <section className="grid gap-3 md:grid-cols-4">
      <div className="rounded border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="flex items-center gap-2 text-sm text-slate-500"><BarChart3 size={16} /> Pricksäkerhet</div>
        <div className="mt-2 text-3xl font-bold">{stats.hitRate === null ? "-" : `${Math.round(stats.hitRate * 100)}%`}</div>
      </div>
      <Metric label="Utvärderade" value={stats.completed} />
      <Metric label="Väntar" value={stats.pending} />
      <Metric label="Snittutfall" value={formatPct(stats.averageReturn)} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}