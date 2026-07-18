import { Activity, Database, ShieldCheck } from "lucide-react";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { FilterForm, ManualScrapeForm, ManualTranscriptForm } from "@/components/forms";
import { AccuracySummary, OutcomeList, OutcomeUpdateForm } from "@/components/outcomes";
import { PostList } from "@/components/post-list";
import { canUseDatabase, getAccuracyOverview, getDashboardStats, listDashboardPosts, listOutcomeEvaluations } from "@/lib/data";
import { hasOpenAIConfig } from "@/lib/openai/client";

function normalizeParams(input: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] || "" : value || ""]),
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
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

function SetupPanel() {
  return (
    <section className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <h2 className="text-base font-semibold">Supabase saknas ännu</h2>
      <p className="mt-1 text-sm leading-6">
        Lägg in <span className="mono">NEXT_PUBLIC_SUPABASE_URL</span> och <span className="mono">SUPABASE_SERVICE_ROLE_KEY</span> i Vercel och kör SQL-migrationerna i Supabase.
      </p>
    </section>
  );
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

  if (hasDb) {
    [posts, stats, accuracy, outcomes] = await Promise.all([
      listDashboardPosts(params),
      getDashboardStats(),
      getAccuracyOverview(),
      listOutcomeEvaluations(),
    ]);
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto grid max-w-7xl gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--accent)]">Manual-first</p>
            <h1 className="text-2xl font-bold">Stockrobber Agent</h1>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1"><ShieldCheck size={14} /> Cron av</span>
            <span className="inline-flex items-center gap-1"><Database size={14} /> {hasDb ? "Supabase redo" : "Supabase saknas"}</span>
            <span className="inline-flex items-center gap-1"><Activity size={14} /> {hasOpenAIConfig() ? "OpenAI redo" : "OpenAI saknas"}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-5 py-4">
        {!hasDb ? <SetupPanel /> : null}
        {params.outcomeError ? <OutcomeErrorPanel message={params.outcomeMessage || "Okänt fel"} /> : null}
        <DashboardTabs active={activeTab} />

        {activeTab === "overview" ? (
          <section className="grid gap-4">
            <AccuracySummary stats={accuracy} />
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Videos" value={stats.posts} />
              <Stat label="Klara" value={stats.analyzed} />
              <Stat label="Misslyckade" value={stats.failed} />
              <Stat label="Bolagsnämningar" value={stats.mentions} />
              <Stat label="Buy candidates" value={stats.buyCandidates} />
            </section>
            <section className="grid gap-3 lg:grid-cols-[0.7fr_1.3fr]">
              <div className="rounded border border-[var(--line)] bg-[var(--panel)] p-4">
                <h2 className="text-base font-semibold">Uppföljning</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Kör uppföljningen manuellt när en tidshorisont passerat. Resultaten sparas och räknas in i pricksäkerheten.</p>
                <div className="mt-4"><OutcomeUpdateForm /></div>
              </div>
              <OutcomeList outcomes={outcomes.slice(0, 5)} />
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
              <div>
                <h2 className="text-xl font-semibold">Uppföljning och pricksäkerhet</h2>
                <p className="mt-1 text-sm text-slate-600">Faktiskt utfall per signal, baserat på pris vid publicering och vid signalens tidshorisont.</p>
              </div>
              <OutcomeUpdateForm />
            </div>
            <AccuracySummary stats={accuracy} />
            <OutcomeList outcomes={outcomes} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
