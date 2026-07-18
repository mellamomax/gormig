import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, Clock3, Database, ShieldCheck } from "lucide-react";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { FilterForm, ManualScrapeForm, ManualTranscriptForm } from "@/components/forms";
import { AccuracySummary, OutcomeList, OutcomeUpdateForm } from "@/components/outcomes";
import { PaperTradingPanel } from "@/components/paper-trading";
import { PostList } from "@/components/post-list";
import { ReliabilityDots } from "@/components/reliability-dots";
import { canUseDatabase, getAccuracyOverview, getDashboardStats, getPaperTradingOverview, listDashboardPosts, listOutcomeEvaluations } from "@/lib/data";
import { addDays, inferHorizonDays, toDateOnly } from "@/lib/market/horizon";
import { buildHorizonDecision, buildPositionSize, buildReliability } from "@/lib/decision";
import { hasOpenAIConfig } from "@/lib/openai/client";
import { defaultSummary, getHeadline, getSummaryMap } from "@/lib/summary";
import type { DashboardPost, Mention, OutcomeEvaluation, PaperTradingSettings, Signal } from "@/lib/types";

type ActionItem = {
  post: DashboardPost;
  mention: Mention;
  signal: Signal;
  headline: string;
  summary: string;
  targetDate: string | null;
  daysLeft: number | null;
  priority: number;
  horizon: ReturnType<typeof buildHorizonDecision>;
  position: ReturnType<typeof buildPositionSize>;
  reliability: ReturnType<typeof buildReliability>;
};

function normalizeParams(input: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] || "" : value || ""]),
  );
}

function formatShortDate(value: string | null) {
  if (!value) return "Oklar";
  return new Intl.DateTimeFormat("sv-SE", { month: "short", day: "numeric" }).format(new Date(value));
}

function actionMeta(action: Signal["action"]) {
  const map = {
    BUY_CANDIDATE: {
      label: "Agera",
      verb: "Bevaka köp",
      badge: "bg-emerald-500 text-white",
      panel: "border-emerald-200 bg-emerald-50",
      text: "text-emerald-950",
    },
    WATCH: {
      label: "Bevaka",
      verb: "Vänta på trigger",
      badge: "bg-cyan-600 text-white",
      panel: "border-cyan-200 bg-cyan-50",
      text: "text-cyan-950",
    },
    HOLD: {
      label: "Avvakta",
      verb: "Behåll koll",
      badge: "bg-slate-700 text-white",
      panel: "border-slate-200 bg-slate-50",
      text: "text-slate-950",
    },
    REDUCE: {
      label: "Minska",
      verb: "Var försiktig",
      badge: "bg-amber-500 text-white",
      panel: "border-amber-200 bg-amber-50",
      text: "text-amber-950",
    },
    AVOID: {
      label: "Undvik",
      verb: "Ingen entry",
      badge: "bg-red-600 text-white",
      panel: "border-red-200 bg-red-50",
      text: "text-red-950",
    },
    INSUFFICIENT_DATA: {
      label: "Saknas",
      verb: "Ingen action",
      badge: "bg-slate-300 text-slate-900",
      panel: "border-slate-200 bg-slate-50",
      text: "text-slate-950",
    },
  } satisfies Record<Signal["action"], { label: string; verb: string; badge: string; panel: string; text: string }>;
  return map[action];
}

function riskLabel(risk: Signal["risk_level"] | undefined) {
  if (risk === "high") return "Hög risk";
  if (risk === "medium") return "Medelrisk";
  if (risk === "low") return "Låg risk";
  return "Risk oklar";
}

function positionTone(tone: ReturnType<typeof buildPositionSize>["tone"]) {
  if (tone === "strong") return "bg-emerald-600 text-white";
  if (tone === "good") return "bg-teal-600 text-white";
  if (tone === "caution") return "bg-amber-500 text-white";
  return "bg-slate-200 text-slate-800";
}

function signalPriority(signal: Signal, daysLeft: number | null) {
  const actionScore = signal.action === "BUY_CANDIDATE" ? 0 : signal.action === "WATCH" ? 2 : signal.action === "REDUCE" || signal.action === "AVOID" ? 4 : 6;
  const timeScore = daysLeft === null ? 5 : daysLeft < 0 ? 1 : daysLeft <= 7 ? 0 : daysLeft <= 30 ? 2 : 4;
  const riskScore = signal.risk_level === "high" ? 2 : signal.risk_level === "unknown" ? 1 : 0;
  return actionScore + timeScore + riskScore;
}

function buildActionItems(posts: DashboardPost[], outcomes: OutcomeEvaluation[]) {
  const outcomesBySignal = new Map(outcomes.map((outcome) => [outcome.signal_id, outcome]));
  const today = new Date(`${toDateOnly(new Date())}T00:00:00.000Z`);
  const items: ActionItem[] = [];

  for (const post of posts) {
    for (const mention of post.mentions || []) {
      for (const signal of mention.signals || []) {
        if (signal.action === "INSUFFICIENT_DATA") continue;

        const outcome = outcomesBySignal.get(signal.id);
        if (outcome && outcome.verdict !== "PENDING") continue;

        const horizonDays = inferHorizonDays(mention.time_horizon);
        const sourceDate = new Date(post.published_at || post.created_at);
        const targetDate = horizonDays === null ? null : toDateOnly(addDays(sourceDate, horizonDays));
        const daysLeft = targetDate === null ? null : Math.ceil((new Date(`${targetDate}T00:00:00.000Z`).getTime() - today.getTime()) / 86400000);

        if (daysLeft !== null && daysLeft < -10) continue;

        const decisionInput = { mention, signal, publishedAt: post.published_at, createdAt: post.created_at };
        const reliability = buildReliability(decisionInput);
        const position = buildPositionSize(decisionInput);

        items.push({
          post,
          mention,
          signal,
          headline: getHeadline(post),
          summary: defaultSummary(getSummaryMap(post)),
          targetDate,
          daysLeft,
          priority: signalPriority(signal, daysLeft) + (5 - reliability.score),
          horizon: buildHorizonDecision(decisionInput),
          position,
          reliability,
        });
      }
    }
  }

  return items.sort((a, b) => a.priority - b.priority || Number(b.signal.confidence) - Number(a.signal.confidence));
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-[var(--foreground)]";
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ActionQueue({ items }: { items: ActionItem[] }) {
  const lead = items[0];
  const rest = items.slice(1, 4);

  if (!lead) {
    return (
      <section className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
        <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">Inget akut</div>
        <h2 className="mt-3 text-xl font-bold">Ingen relevant action just nu</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-600">Nya analyser med ticker och tidshorisont hamnar här automatiskt.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
      <LeadAction item={lead} />
      <div className="grid content-start gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-normal text-slate-500">Nästa att följa</h2>
          <Link className="text-sm font-semibold text-[var(--accent)]" href="/?tab=videos">Alla analyser</Link>
        </div>
        {rest.length ? rest.map((item) => <MiniAction key={`${item.signal.id}-${item.post.id}`} item={item} />) : (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 text-sm text-slate-600">Bara en aktuell signal just nu.</div>
        )}
      </div>
    </section>
  );
}

function LeadAction({ item }: { item: ActionItem }) {
  const meta = actionMeta(item.signal.action);
  return (
    <article className={`rounded-xl border p-4 shadow-sm ${meta.panel} ${meta.text}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${meta.badge}`}>{meta.label}</div>
          <h2 className="mt-3 text-3xl font-black tracking-normal">{item.mention.ticker || item.mention.company_name}</h2>
          <p className="mt-1 text-base font-semibold">{meta.verb} · {item.mention.company_name}</p>
        </div>
        <div className="grid gap-2 rounded-lg bg-white/75 p-2.5 text-right shadow-sm">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Storlek</div>
            <div className={`mt-1 inline-flex rounded px-2 py-1 text-sm font-black ${positionTone(item.position.tone)}`}>{item.position.label} · {item.position.percent}%</div>
          </div>
          <ReliabilityDots compact score={item.reliability.score} label={item.reliability.label} />
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Pill label="Beslut" value={item.position.label === "Ingen" ? "Vänta" : "Agera nu"} />
        <Pill label="Horisont" value={item.horizon.bucket} />
        <Pill label="Risk" value={riskLabel(item.signal.risk_level)} />
        <Pill label="Confidence" value={`${Math.round(item.signal.confidence * 100)}%`} />
      </div>

      <div className="mt-3 rounded-lg bg-white/70 p-3">
        <p className="text-sm font-black">{item.horizon.headline}</p>
        <p className="mt-1 text-sm leading-6 opacity-85">{item.horizon.detail}</p>
      </div>

      <p className="mt-3 max-w-3xl truncate text-base font-semibold">Varför: {item.headline}</p>
      <p className="mt-1 max-w-3xl truncate text-sm opacity-80">{item.summary}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#071d19] px-3 text-sm font-bold !text-white shadow-sm" href={`/posts/${item.post.id}`}>
          Öppna analys <ArrowRight size={16} />
        </Link>
        <span className="text-sm font-semibold">Uppföljning: {item.targetDate ? formatShortDate(item.targetDate) : "oklar"}</span>
      </div>
    </article>
  );
}

function MiniAction({ item }: { item: ActionItem }) {
  const meta = actionMeta(item.signal.action);
  return (
    <Link className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5 shadow-sm hover:border-[var(--accent)]" href={`/posts/${item.post.id}`}>
      <span className={`rounded px-2 py-1 text-xs font-bold uppercase ${meta.badge}`}>{meta.label}</span>
      <span className="min-w-0">
        <span className="block truncate font-bold">{item.mention.ticker || item.mention.company_name}</span>
        <span className="block truncate text-sm text-slate-600">{item.horizon.headline} · {item.position.label} {item.position.percent}%</span>
      </span>
      <span className="grid justify-items-end gap-1 text-right text-xs font-bold text-slate-600">
        <span>{item.horizon.bucket}</span>
        <ReliabilityDots compact score={item.reliability.score} />
      </span>
    </Link>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/75 p-2.5 shadow-sm">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 font-black">{value}</div>
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

function ScrapeErrorPanel({ message }: { message: string }) {
  return (
    <section className="rounded border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      Scrape kunde inte köras. Fel: {message || "Okänt fel"}
    </section>
  );
}

function ScrapeResultPanel({ params }: { params: Record<string, string> }) {
  return (
    <section className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
      Scrape klar: hittade {params.found || "0"}, nya {params.inserted || "0"}, redan sparade {params.skipped || "0"}.
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

  const actionItems = buildActionItems(posts, outcomes);
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto grid max-w-7xl gap-2 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-normal text-[var(--accent)]">Privat beslutsdashboard</p>
            <h1 className="text-2xl font-black">Stockrobber Agent</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-3 py-1"><ShieldCheck size={14} /> Manuellt läge</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-3 py-1"><Database size={14} /> {hasDb ? "Data redo" : "Data saknas"}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-3 py-1"><Activity size={14} /> {hasOpenAIConfig() ? "AI redo" : "AI saknas"}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-3">
        {!hasDb ? <SetupPanel /> : null}
        {params.outcomeError ? <OutcomeErrorPanel message={params.outcomeMessage || "Okänt fel"} /> : null}
        {params.outcomeStatus ? <OutcomeResultPanel params={params} /> : null}
        {params.scrapeError ? <ScrapeErrorPanel message={params.scrapeMessage || "Okänt fel"} /> : null}
        {params.scrapeStatus ? <ScrapeResultPanel params={params} /> : null}
        <DashboardTabs active={activeTab} />

        {activeTab === "overview" ? (
          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <ActionQueue items={actionItems} />
            <aside className="grid content-start gap-3">
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
                <Stat label="Aktuella" value={actionItems.length} tone={actionItems.length ? "good" : undefined} />
                <Stat label="Träff" value={accuracy.hitRate === null ? "-" : `${Math.round(accuracy.hitRate * 100)}%`} tone={accuracy.hitRate !== null && accuracy.hitRate >= 0.5 ? "good" : undefined} />
                <Stat label="Väntar" value={accuracy.pending} />
              </div>
              <PaperTradingPanel overview={paper} compact />
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 shadow-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold"><Clock3 size={16} /> Utfall</div>
                  <p className="mt-1 truncate text-xs text-slate-600">När horisonten passerat.</p>
                </div>
                <OutcomeUpdateForm />
              </div>
            </aside>
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
              <h2 className="flex items-center gap-2 text-xl font-black"><CheckCircle2 size={20} /> Uppföljning</h2>
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
