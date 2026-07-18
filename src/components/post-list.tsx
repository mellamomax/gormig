import Link from "next/link";
import { getCategoryLabel, getHeadline, getMentionedStockLabel, getPrimarySignal, getSummaryMap, defaultSummary } from "@/lib/summary";
import type { DashboardPost } from "@/lib/types";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sv-SE", { month: "short", day: "numeric", year: "2-digit" }).format(new Date(value));
}

function riskLabel(risk?: string) {
  if (!risk) return "-";
  return risk === "unknown" ? "okänd" : risk;
}

export function PostList({ posts }: { posts: DashboardPost[] }) {
  if (posts.length === 0) {
    return (
      <section className="rounded border border-dashed border-[var(--line)] bg-[var(--panel)] p-8 text-center text-slate-600">
        Inga videos ännu. Lägg till en transkription manuellt för första testet.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded border border-[var(--line)] bg-[var(--panel)]">
      <div className="grid grid-cols-[6rem_8rem_minmax(12rem,1.2fr)_5rem_8rem_minmax(13rem,1fr)] gap-3 border-b border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-xs font-semibold uppercase text-slate-500">
        <span>Datum</span>
        <span>Kategori</span>
        <span>Titel</span>
        <span>Risk</span>
        <span>Aktie</span>
        <span>Summering</span>
      </div>
      {posts.map((post) => {
        const signal = getPrimarySignal(post);
        const summary = defaultSummary(getSummaryMap(post));
        return (
          <Link
            key={post.id}
            className="grid grid-cols-[6rem_8rem_minmax(12rem,1.2fr)_5rem_8rem_minmax(13rem,1fr)] gap-3 border-b border-[var(--line)] px-3 py-2 text-sm last:border-b-0 hover:bg-[var(--panel-2)]"
            href={`/posts/${post.id}`}
          >
            <span className="text-slate-500">{formatDate(post.published_at || post.created_at)}</span>
            <span className="truncate font-medium text-slate-700">{getCategoryLabel(post)}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-[var(--foreground)]">{post.caption || post.url}</span>
              <span className="block truncate text-xs text-slate-500">{getHeadline(post)}</span>
            </span>
            <span className={signal?.risk_level === "high" ? "font-semibold text-red-700" : signal?.risk_level === "medium" ? "font-semibold text-amber-700" : "text-slate-600"}>{riskLabel(signal?.risk_level)}</span>
            <span className="truncate font-medium text-slate-700">{getMentionedStockLabel(post)}</span>
            <span className="truncate text-slate-600">{summary}</span>
          </Link>
        );
      })}
    </section>
  );
}
