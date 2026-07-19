"use client";

import Link from "next/link";
import { Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deletePostsAction } from "@/app/actions";
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
  const [editing, setEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (posts.length === 0) {
    return (
      <section className="rounded border border-dashed border-[var(--line)] bg-[var(--panel)] p-8 text-center text-slate-600">
        Inga videos ännu. Lägg till en transkription manuellt för första testet.
      </section>
    );
  }

  const selectedCount = selectedIds.length;
  const allSelected = selectedCount === posts.length;

  function togglePost(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : posts.map((post) => post.id));
  }

  return (
    <section className="rounded border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--panel-2)] px-3 py-2">
        <div className="text-sm font-bold">{posts.length} videos</div>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? <span className="text-xs font-semibold text-slate-500">{selectedCount} valda</span> : null}
          {editing ? (
            <button className="inline-flex items-center gap-1 rounded border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold" type="button" onClick={() => { setEditing(false); setSelectedIds([]); }}>
              <X size={15} /> Klar
            </button>
          ) : (
            <button className="inline-flex items-center gap-1 rounded border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold" type="button" onClick={() => setEditing(true)}>
              <Pencil size={15} /> Redigera
            </button>
          )}
        </div>
      </div>
      <form
        action={deletePostsAction}
        onSubmit={(event) => {
          if (selectedCount === 0 || !window.confirm(`Radera ${selectedCount} videos och all analysdata?`)) {
            event.preventDefault();
          }
        }}
      >
        {editing ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
            <button className="rounded border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold" type="button" onClick={toggleAll}>
              {allSelected ? "Avmarkera alla" : "Markera alla"}
            </button>
            <DeleteSelectedButton selectedCount={selectedCount} />
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <div className={`grid min-w-[58rem] ${editing ? "grid-cols-[3rem_6rem_8rem_minmax(12rem,1.2fr)_5rem_8rem_minmax(13rem,1fr)]" : "grid-cols-[6rem_8rem_minmax(12rem,1.2fr)_5rem_8rem_minmax(13rem,1fr)]"} gap-3 border-b border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-xs font-semibold uppercase text-slate-500`}>
            {editing ? <span>Välj</span> : null}
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
            const rowClass = `grid min-w-[58rem] ${editing ? "grid-cols-[3rem_6rem_8rem_minmax(12rem,1.2fr)_5rem_8rem_minmax(13rem,1fr)]" : "grid-cols-[6rem_8rem_minmax(12rem,1.2fr)_5rem_8rem_minmax(13rem,1fr)]"} gap-3 border-b border-[var(--line)] px-3 py-2 text-sm last:border-b-0 hover:bg-[var(--panel-2)]`;
            const rowContent = (
              <>
                <span className="text-slate-500">{formatDate(post.published_at || post.created_at)}</span>
                <span className="truncate font-medium text-slate-700">{getCategoryLabel(post)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[var(--foreground)]">{post.caption || post.url}</span>
                  <span className="block truncate text-xs text-slate-500">{getHeadline(post)}</span>
                </span>
                <span className={signal?.risk_level === "high" ? "font-semibold text-red-700" : signal?.risk_level === "medium" ? "font-semibold text-amber-700" : "text-slate-600"}>{riskLabel(signal?.risk_level)}</span>
                <span className="truncate font-medium text-slate-700">{getMentionedStockLabel(post)}</span>
                <span className="truncate text-slate-600">{summary}</span>
              </>
            );

            return editing ? (
              <div key={post.id} className={rowClass}>
                <label className="flex items-center">
                  <input checked={selectedIds.includes(post.id)} className="h-4 w-4" name="postId" type="checkbox" value={post.id} onChange={() => togglePost(post.id)} />
                </label>
                <Link className="contents" href={`/posts/${post.id}`}>
                  {rowContent}
                </Link>
              </div>
            ) : (
              <Link key={post.id} className={rowClass} href={`/posts/${post.id}`}>
                {rowContent}
              </Link>
            );
          })}
        </div>
      </form>
    </section>
  );
}

function DeleteSelectedButton({ selectedCount }: { selectedCount: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="inline-flex items-center gap-2 rounded bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending || selectedCount === 0}
      type="submit"
    >
      <Trash2 size={15} /> {pending ? "Raderar..." : `Radera ${selectedCount || ""}`.trim()}
    </button>
  );
}
