import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { analyzePostAction, transcribePostAction } from "@/app/actions";
import { RiskBadge, SignalBadge, StatusBadge } from "@/components/badges";
import { ExplainLevelSelect } from "@/components/explain-level-select";
import { SubmitButton } from "@/components/submit-button";
import type { DashboardPost } from "@/lib/types";

function formatDate(value: string | null) {
  if (!value) return "Datum saknas";
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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
    <section className="grid gap-3">
      {posts.map((post) => {
        const firstMention = post.mentions?.[0];
        const firstSignal = firstMention?.signals?.[0];
        return (
          <article key={post.id} className="grid gap-4 rounded border border-[var(--line)] bg-[var(--panel)] p-4 lg:grid-cols-[1.6fr_1fr_auto]">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={post.processing_status} />
                <span className="text-sm text-slate-500">{formatDate(post.published_at)}</span>
              </div>
              <Link className="text-lg font-semibold hover:text-[var(--accent)]" href={`/posts/${post.id}`}>
                {post.caption || post.url}
              </Link>
              <p className="line-clamp-2 text-sm leading-6 text-slate-600">{post.transcript || "Ingen transkription sparad ännu."}</p>
              <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                {(post.mentions || []).slice(0, 4).map((mention) => (
                  <Link key={mention.id} className="rounded border border-[var(--line)] px-2 py-1 hover:border-[var(--accent)]" href={`/stocks/${encodeURIComponent(mention.ticker || mention.company_name)}`}>
                    {mention.ticker || mention.company_name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="grid content-start gap-2">
              <SignalBadge signal={firstSignal} />
              <RiskBadge risk={firstSignal?.risk_level} />
              {firstMention ? <p className="text-sm leading-6 text-slate-700">{firstMention.thesis}</p> : <p className="text-sm text-slate-500">Ingen analys ännu.</p>}
            </div>
            <div className="flex flex-wrap items-start gap-2 lg:flex-col">
              <Link className="inline-flex items-center gap-2 rounded border border-[var(--line)] px-3 py-2 text-sm font-medium" href={post.url} target="_blank">
                <ExternalLink size={15} /> TikTok
              </Link>
              {post.media_url && !post.transcript ? (
                <form action={transcribePostAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <SubmitButton label="Transkribera" pendingLabel="Transkriberar..." tone="accent" className="px-3" />
                </form>
              ) : null}
              {post.transcript ? (
                <form action={analyzePostAction} className="grid gap-2">
                  <input type="hidden" name="postId" value={post.id} />
                  <ExplainLevelSelect compact />
                  <SubmitButton label="Analysera" pendingLabel="Analyserar..." className="px-3" />
                </form>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
