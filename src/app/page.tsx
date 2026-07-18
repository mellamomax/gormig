import { Activity, Database, ShieldCheck, TrendingUp } from "lucide-react";
import { FilterForm, ManualScrapeForm, ManualTranscriptForm } from "@/components/forms";
import { PostList } from "@/components/post-list";
import { canUseDatabase, getDashboardStats, listDashboardPosts } from "@/lib/data";
import { hasOpenAIConfig } from "@/lib/openai/client";

function normalizeParams(input: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] || "" : value || ""]),
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function SetupPanel() {
  return (
    <section className="rounded border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <h2 className="text-lg font-semibold">Supabase saknas ännu</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6">
        Lägg in <span className="mono">NEXT_PUBLIC_SUPABASE_URL</span> och <span className="mono">SUPABASE_SERVICE_ROLE_KEY</span> i Vercel och kör SQL-migrationen i Supabase. Appen är byggd för manuella tester först och har ingen aktiv cron.
      </p>
    </section>
  );
}

export default async function Home({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const rawParams = searchParams ? await searchParams : {};
  const params = normalizeParams(rawParams);
  const hasDb = canUseDatabase();
  const [posts, stats] = hasDb
    ? await Promise.all([listDashboardPosts(params), getDashboardStats()])
    : [[], { posts: 0, analyzed: 0, failed: 0, mentions: 0, buyCandidates: 0 }];

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-[var(--accent)]">Manual-first</p>
            <h1 className="mt-1 text-3xl font-bold">Stockrobber Agent</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Privat dashboard för att testa transkriptioner, analyser och kontrollerad scraping innan någon automation aktiveras.</p>
          </div>
          <div className="grid gap-2 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> Cron är avstängd</span>
            <span className="inline-flex items-center gap-2"><Database size={16} /> {hasDb ? "Supabase redo" : "Supabase ej konfigurerad"}</span>
            <span className="inline-flex items-center gap-2"><Activity size={16} /> {hasOpenAIConfig() ? "OpenAI redo" : "OpenAI ej konfigurerad"}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6">
        {!hasDb ? <SetupPanel /> : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Videos" value={stats.posts} />
          <Stat label="Klara" value={stats.analyzed} />
          <Stat label="Misslyckade" value={stats.failed} />
          <Stat label="Bolagsnämningar" value={stats.mentions} />
          <Stat label="Buy candidates" value={stats.buyCandidates} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <ManualTranscriptForm />
          <ManualScrapeForm />
        </section>

        <section className="grid gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} />
            <h2 className="text-xl font-semibold">Senaste videos</h2>
          </div>
          <FilterForm params={params} />
          <PostList posts={posts} />
        </section>
      </div>
    </main>
  );
}
