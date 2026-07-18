import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { analyzePostAction, transcribePostAction } from "@/app/actions";
import { RiskBadge, SignalBadge, StatusBadge } from "@/components/badges";
import { OutcomeUpdateForm } from "@/components/outcomes";
import { SubmitButton } from "@/components/submit-button";
import { SummaryLevelSwitcher } from "@/components/summary-level-switcher";
import { canUseDatabase, getPostWithAnalysis, listOutcomeEvaluations } from "@/lib/data";
import { getHeadline, getMentionedStockLabel, getSummaryMap } from "@/lib/summary";

function formatDate(value: string | null) {
  if (!value) return "Datum saknas";
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function verdictLabel(verdict: string) {
  const labels: Record<string, string> = {
    PENDING: "Väntar",
    NO_DATA: "Ingen data",
    POSITIVE_HIT: "Träff upp",
    NEGATIVE_HIT: "Träff ned",
    NEUTRAL_HIT: "Träff neutral",
    MISS: "Miss",
    IGNORED: "Ignorerad",
  };
  return labels[verdict] || verdict;
}

export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  if (!canUseDatabase()) notFound();
  const { id } = await params;
  const post = await getPostWithAnalysis(id);
  const rawParams = searchParams ? await searchParams : {};
  const outcomeError = firstParam(rawParams.outcomeError);
  const outcomeMessage = firstParam(rawParams.outcomeMessage);
  const outcomeStatus = firstParam(rawParams.outcomeStatus);
  const checked = firstParam(rawParams.checked) || "0";
  const updated = firstParam(rawParams.updated) || "0";
  const pending = firstParam(rawParams.pending) || "0";
  const skipped = firstParam(rawParams.skipped) || "0";
  const noData = firstParam(rawParams.noData) || "0";
  const failed = firstParam(rawParams.failed) || "0";
  const outcomeErrors = (firstParam(rawParams.errors) || "").split(" | ").filter(Boolean);
  if (!post) notFound();
  const outcomes = (await listOutcomeEvaluations()).filter((outcome) => outcome.post_id === post.id);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto grid max-w-6xl gap-4 px-5 py-5">
        <Link className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600" href="/">
          <ArrowLeft size={16} /> Till dashboard
        </Link>

        <section className="rounded border border-[var(--line)] bg-[var(--panel)] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={post.processing_status} />
            <span className="text-sm text-slate-500">{formatDate(post.published_at || post.created_at)}</span>
            <span className="text-sm font-medium text-slate-600">{getMentionedStockLabel(post)}</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold">{post.caption || "Video utan titel"}</h1>
          <div className="mt-4">
            <SummaryLevelSwitcher summaries={getSummaryMap(post)} headline={getHeadline(post)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="inline-flex items-center gap-2 rounded border border-[var(--line)] px-3 py-2 text-sm font-medium" href={post.url} target="_blank">
              <ExternalLink size={15} /> Öppna TikTok
            </Link>
            {post.media_url && !post.transcript ? (
              <form action={transcribePostAction}>
                <input type="hidden" name="postId" value={post.id} />
                <SubmitButton label="Transkribera" pendingLabel="Transkriberar..." tone="accent" className="px-3" />
              </form>
            ) : null}
            {post.transcript ? (
              <form action={analyzePostAction}>
                <input type="hidden" name="postId" value={post.id} />
                <SubmitButton label="Analysera igen" pendingLabel="Analyserar..." className="px-3" />
              </form>
            ) : null}
          </div>
          {outcomeError ? (
            <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Uppföljning kunde inte köras. Fel: {outcomeMessage || "Okänt fel"}</p>
          ) : null}
          {outcomeStatus ? (
            <div className={`mt-4 rounded border p-3 text-sm ${Number(failed) > 0 ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
              <p>Uppföljning klar: kontrollerade {checked}, uppdaterade {updated}, väntar {pending}, ignorerade {skipped}, ingen data {noData}, misslyckade {failed}.</p>
              {outcomeErrors.length ? <p className="mt-2 font-medium">Felorsak: {outcomeErrors.join(" / ")}</p> : null}
            </div>
          ) : null}
          {(post.mentions || []).some((mention) => (mention.signals || []).length > 0) ? (
            <div className="mt-4"><OutcomeUpdateForm postId={post.id} /></div>
          ) : null}
          {post.processing_error ? <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">{post.processing_error}</p> : null}
        </section>

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Aktier och analys</h2>
          {(post.mentions || []).length === 0 ? <p className="rounded border border-dashed border-[var(--line)] bg-[var(--panel)] p-5 text-sm text-slate-600">Ingen analys sparad ännu.</p> : null}
          {(post.mentions || []).map((mention) => {
            const signal = mention.signals?.[0];
            const outcome = signal ? outcomes.find((item) => item.signal_id === signal.id) : null;
            return (
              <article key={mention.id} className="rounded border border-[var(--line)] bg-[var(--panel)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link className="text-xl font-semibold hover:text-[var(--accent)]" href={`/stocks/${encodeURIComponent(mention.ticker || mention.company_name)}`}>
                      {mention.company_name} {mention.ticker ? <span className="text-slate-500">({mention.ticker})</span> : null}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">{mention.exchange || "Börs saknas"} · sentiment {mention.sentiment} · confidence {Math.round(mention.confidence * 100)}%</p>
                  </div>
                  <div className="grid justify-items-start gap-1 sm:justify-items-end">
                    <SignalBadge signal={signal} />
                    <RiskBadge risk={signal?.risk_level} />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-700">{mention.thesis}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <List title="Argument" items={mention.arguments} />
                  <List title="Risker" items={mention.risks} />
                  <List title="Katalysatorer" items={mention.catalysts} />
                </div>
                {signal ? <p className="mt-4 rounded bg-[var(--panel-2)] p-3 text-sm leading-6 text-slate-700">{signal.reasoning}</p> : null}
                {outcome ? (
                  <div className="mt-3 rounded border border-[var(--line)] p-3 text-sm text-slate-700">
                    <div className="font-semibold">Uppföljning: {verdictLabel(outcome.verdict)}</div>
                    <div className="mt-1">{outcome.notes}</div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

        <details className="rounded border border-[var(--line)] bg-[var(--panel)] p-5">
          <summary className="cursor-pointer text-lg font-semibold">Visa transkription</summary>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{post.transcript || "Ingen transkription ännu."}</p>
        </details>
      </div>
    </main>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? <p className="mt-2 text-sm text-slate-500">Saknas</p> : null}
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-700">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}
