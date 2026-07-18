import { Activity, Database, ShieldCheck, Sparkles } from "lucide-react";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { FilterForm, ManualScrapeForm, ManualTranscriptForm } from "@/components/forms";
import { AccuracySummary, OutcomeList, OutcomeUpdateForm } from "@/components/outcomes";
import { PaperTradingPanel } from "@/components/paper-trading";
import { PostList } from "@/components/post-list";
import { canUseDatabase, getAccuracyOverview, getDashboardStats, getPaperTradingOverview, listDashboardPosts, listOutcomeEvaluations } from "@/lib/data";
import { hasOpenAIConfig } from "@/lib/openai/client";
import type { PaperTradingSettings } from "@/lib/types";

function normalizeParams(input: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] || "" : value || ""]),
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-[var(--foreground)]";
  return (
    <div className="rounded border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function OutcomeErrorPanel({ message }: { message: string }) {
  return (
    <section className="rounded border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      Uppföljning kunde inte köras. Fel: {message || "Okänt fel"}
    </section>
  );
}

function OutcomeResultPanel({ params }: { params: Record<string, string> }) {
  const checked = Number(params.checked || 0);
  const updated = Number(params.updated || 0);
  const pending = Number(params.pending || 0);
  const skipped = Number(params.skipped || 0);
  const noData = Number(params.noData || 0);
  const failed = Number(params.failed || 0);
  const errors = (params.errors || "").split(" | ").filter(Boolean);
  const hasFailures = failed > 0;

  return (
    <section className={`rounded border p-4 text-sm leading-6 ${hasFailures ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
      <p>{checked === 0 ? "Inga uppföljningsbara signaler hittades." : `Uppföljning klar: ${updated} klara, ${pending} väntar, ${skipped} ignorerade, ${noData} utan data, ${failed} fel.`}</p>
      {errors.length ? <p className="mt-2 font-medium">Felorsak: {errors.join(" / ")}</p> : null}
    </section>
  );
}

function SetupPanel() {
  return (
    <section className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <h2 className="text-base font-semibold">Setup saknas</h2>
      <p className="mt-1 text-sm">Lägg in Supabase-variabler och kör migrationerna.</p>
    </section>
  );
}

function paperFallback(): Awaited<ReturnType<typeof getPaperTradingOverview>> {
  const settings: PaperTradingSettings = {
    id: true,
    enabled: false,
    starting_cash: 100000,
    allocation_per_trade: 10000,
    activated_at: null,
    updated_at: new Date(0).toISOString(),
  };
  return { settings, trades: [], activeTrades: 0, settledTrades: 0, allocated: 0, activeAllocated: 0, cashAvailable: 100000, realizedPnl: 0, paperValue: 100000, returnPct: null, hitRate: null };
}

export default async function Home({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const rawParams = searchParams ? await searchParams : {};
  const params = normalizeParams(rawParams);
  const activeTab = params.tab || "overview";
  const hasDb = canUseDatabase();
  let posts: Awaited<ReturnType<typeof listDashboardPosts>> = [];
  let stats: Awaited<ReturnType<typeof getDashboardStats>> = { posts: 0, analyzed: 0, failed: 0, mentions: 0, buyCandidates: 0 };
  let accuracy: Awaited<ReturnType<typeof getAccuracyOverview>> = { outcomes: 0, completed: 0, pending: 0, noData: 0, successes: 0, hitRate: null, averageReturn: 0 };
  let outcomes: Awaited<ReturnType<typeof listOutcomeEvaluations>> = [];
  let paper = paperFallback();

  if (hasDb) {
    [posts, stats, accuracy, outcomes, paper] = await Promise.all([
      listDashboardPosts(params),
      getDashboardStats(),
      getAccuracyOverview(),
      listOutcomeEvaluations(),
      getPaperTradingOverview(),
    ]);
  }

  const latestAnalyzed = posts.filter((post) => post.processing_status === "analyzed").slice(0, 8);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto grid max-w-7xl gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--accent)]">Privat analysplattform</p>
            <h1 className="text-2xl font-bold">Stockrobber Agent</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded border border-[var(--line)] px-2 py-1"><ShieldCheck size={14} /> Manuell kontroll</span>
            <span className="inline-flex items-center gap-1 rounded border border-[var(--line)] px-2 py-1"><Database size={14} /> {hasDb ? "Data redo" : "Data saknas"}</span>
            <span className="inline-flex items-center gap-1 rounded border border-[var(--line)] px-2 py-1"><Activity size={14} /> {hasOpenAIConfig() ? "AI redo" : "AI saknas"}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-5 py-4">
        {!hasDb ? <SetupPanel /> : null}
        {params.outcomeError ? <OutcomeErrorPanel message={params.outcomeMessage || "Okänt fel"} /> : null}
        {params.outcomeStatus ? <OutcomeResultPanel params={params} /> : null}
        <DashboardTabs active={activeTab} />

        {activeTab === "overview" ? (
          <section className="grid gap-4">
            <section className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded border border-[var(--line)] bg-[var(--panel)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"><Sparkles size={16} /> Kort läge</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <Stat label="Analyser" value={stats.analyzed} />
                  <Stat label="Köpkandidater" value={stats.buyCandidates} />
                  <Stat label="Väntar utfall" value={accuracy.pending} />
                  <Stat label="Pricksäkerhet" value={accuracy.hitRate === null ? "-" : `${Math.round(accuracy.hitRate * 100)}%`} tone={accuracy.hitRate !== null && accuracy.hitRate >= 0.5 ? "good" : undefined} />
                </div>
              </div>
              <PaperTradingPanel overview={paper} compact />
            </section>

            <section className="grid gap-3 lg:grid-cols-[1fr_0.9fr]">
              <section className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Senaste analyser</h2>
                  <a className="text-sm font-medium text-[var(--accent)]" href="/?tab=videos">Alla videos</a>
                </div>
                <PostList posts={latestAnalyzed.length ? latestAnalyzed : posts.slice(0, 8)} />
              </section>
              <section className="grid content-start gap-3">
                <div className="flex items-center justify-between gap-3 rounded border border-[var(--line)] bg-[var(--panel)] p-4">
                  <div>
                    <h2 className="text-base font-semibold">Uppföljning</h2>
                    <p className="mt-1 text-sm text-slate-600">Kolla faktiska utfall när horisonten passerat.</p>
                  </div>
                  <OutcomeUpdateForm />
                </div>
                <OutcomeList outcomes={outcomes.slice(0, 5)} />
              </section>
            </section>
          </section>
        ) : null}

        {activeTab === "videos" ? (
          <section className="grid gap-4">
            <FilterForm params={params} />
            <PostList posts={posts} />
          </section>
        ) : null}

        {activeTab === "manual" ? <ManualTranscriptForm /> : null}
        {activeTab === "scrape" ? <ManualScrapeForm /> : null}

        {activeTab === "outcomes" ? (
          <section className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Uppföljning</h2>
              <OutcomeUpdateForm />
            </div>
            <AccuracySummary stats={accuracy} />
            <OutcomeList outcomes={outcomes} />
          </section>
        ) : null}

        {activeTab === "paper" ? <PaperTradingPanel overview={paper} /> : null}
      </div>
    </main>
  );
}
