import Link from "next/link";
import { ArrowUpRight, Newspaper, TrendingUp } from "lucide-react";
import type { FollowUpEvent } from "@/lib/types";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function eventTone(event: FollowUpEvent) {
  if (event.severity === "important") return "border-amber-300 bg-amber-50 text-amber-950";
  if (event.severity === "watch") return "border-cyan-200 bg-cyan-50 text-cyan-950";
  return "border-[var(--line)] bg-[var(--panel)] text-[var(--foreground)]";
}

export function FollowUpFeed({ events }: { events: FollowUpEvent[] }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-black">
          <TrendingUp size={18} /> Senaste uppföljningar
        </h2>
        <Link className="text-xs font-bold text-[var(--accent)]" href="/?tab=outcomes">Alla</Link>
      </div>

      {events.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel-2)] p-3 text-sm text-slate-600">
          Inget nytt ännu. Cron fyller på när pris eller nyheter ändrar läget.
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {events.slice(0, 5).map((event) => (
            <article key={event.id} className={`rounded-lg border p-3 ${eventTone(event)}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/70">
                  {event.event_type === "news" ? <Newspaper size={16} /> : <TrendingUp size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/70 px-2 py-0.5 text-xs font-black">{event.ticker}</span>
                    <span className="text-xs font-semibold opacity-70">{formatTime(event.observed_at)}</span>
                  </div>
                  <h3 className="mt-1 line-clamp-2 text-sm font-black">{event.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-80">{event.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                    {event.post_id ? <Link className="text-[var(--accent)]" href={`/posts/${event.post_id}`}>Öppna analys</Link> : null}
                    {event.source_url ? (
                      <Link className="inline-flex items-center gap-1 text-slate-600" href={event.source_url} target="_blank">
                        Källa <ArrowUpRight size={12} />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
