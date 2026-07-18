import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RiskBadge, SignalBadge } from "@/components/badges";
import { canUseDatabase, listStockHistory } from "@/lib/data";

function formatDate(value?: string | null) {
  if (!value) return "Datum saknas";
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  if (!canUseDatabase()) notFound();
  const { ticker } = await params;
  const decoded = decodeURIComponent(ticker);
  const history = await listStockHistory(decoded);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto grid max-w-5xl gap-5 px-5 py-6">
        <Link className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600" href="/">
          <ArrowLeft size={16} /> Till dashboard
        </Link>
        <header className="rounded border border-[var(--line)] bg-[var(--panel)] p-5">
          <p className="text-sm font-semibold uppercase text-[var(--accent)]">Aktiehistorik</p>
          <h1 className="mt-1 text-3xl font-bold">{decoded.toUpperCase()}</h1>
          <p className="mt-2 text-sm text-slate-600">Alla sparade videos där aktien eller bolaget nämnts. Kurs vid publicering kan läggas till senare när marknadsdata kopplas in.</p>
        </header>

        {history.length === 0 ? <p className="rounded border border-dashed border-[var(--line)] bg-[var(--panel)] p-5 text-slate-600">Ingen historik ännu.</p> : null}
        {history.map((mention) => {
          const signal = mention.signals?.[0];
          const post = mention.posts;
          return (
            <article key={mention.id} className="rounded border border-[var(--line)] bg-[var(--panel)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link className="text-lg font-semibold hover:text-[var(--accent)]" href={post ? `/posts/${post.id}` : "#"}>
                    {post?.caption || post?.url || mention.company_name}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">{formatDate(post?.published_at)} · sentiment {mention.sentiment} · confidence {Math.round(mention.confidence * 100)}%</p>
                </div>
                <div className="grid justify-items-start gap-1 sm:justify-items-end">
                  <SignalBadge signal={signal} />
                  <RiskBadge risk={signal?.risk_level} />
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{mention.thesis}</p>
              {signal ? <p className="mt-3 rounded bg-[var(--panel-2)] p-3 text-sm leading-6 text-slate-700">{signal.reasoning}</p> : null}
            </article>
          );
        })}
      </div>
    </main>
  );
}
