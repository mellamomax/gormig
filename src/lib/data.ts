import { createHash } from "crypto";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase/server";
import { EXPLAIN_LEVELS } from "@/lib/explain-level";
import { addDays, inferHorizonDays, toDateOnly } from "@/lib/market/horizon";
import { classifySourcePost } from "@/lib/relevance";
import type { AnalysisResponse } from "@/lib/schemas";
import { extractTikTokVideoId } from "@/lib/tiktok";
import type { Creator, DashboardPost, Mention, OutcomeEvaluation, PaperTrade, PaperTradingSettings, Post, Signal, SourcePost } from "@/lib/types";

const DEFAULT_USERNAME = process.env.TIKTOK_USERNAME || "stockrobber";
const DEFAULT_PROFILE_URL = `https://www.tiktok.com/@${DEFAULT_USERNAME}`;

function hashText(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 20);
}

export function canUseDatabase() {
  return hasSupabaseConfig();
}

export async function ensureDefaultCreator(username = DEFAULT_USERNAME): Promise<Creator> {
  const supabase = getSupabaseAdmin();
  const profileUrl = `https://www.tiktok.com/@${username}`;
  const { data, error } = await supabase
    .from("creators")
    .upsert(
      { platform: "tiktok", username, profile_url: profileUrl },
      { onConflict: "platform,username" },
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Creator;
}

export async function listDashboardPosts(filters: {
  search?: string;
  status?: string;
  signal?: string;
  risk?: string;
  ticker?: string;
} = {}) {
  if (!canUseDatabase()) return [] as DashboardPost[];

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("posts")
    .select("*, creators(username, profile_url), mentions(*, signals(*))")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.status && filters.status !== "all") {
    query = query.eq("processing_status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data || []) as unknown as DashboardPost[];

  if (filters.search) {
    const needle = filters.search.toLowerCase();
    rows = rows.filter((post) => {
      const haystack = [post.url, post.caption, post.transcript, ...(post.mentions || []).map((m) => `${m.company_name} ${m.ticker || ""}`)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  if (filters.ticker) {
    const ticker = filters.ticker.toLowerCase();
    rows = rows.filter((post) => (post.mentions || []).some((mention) => (mention.ticker || "").toLowerCase() === ticker));
  }

  if (filters.signal && filters.signal !== "all") {
    rows = rows.filter((post) =>
      (post.mentions || []).some((mention) => (mention.signals || []).some((signal) => signal.action === filters.signal)),
    );
  }

  if (filters.risk && filters.risk !== "all") {
    rows = rows.filter((post) =>
      (post.mentions || []).some((mention) => (mention.signals || []).some((signal) => signal.risk_level === filters.risk)),
    );
  }

  return rows;
}


const DEFAULT_PAPER_SETTINGS: PaperTradingSettings = {
  id: true,
  enabled: false,
  starting_cash: 100000,
  allocation_per_trade: 10000,
  activated_at: null,
  updated_at: new Date(0).toISOString(),
};

function tableMissing(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("paper_settings") || error?.message?.includes("paper_trades"));
}

export async function getPaperTradingSettings(): Promise<PaperTradingSettings> {
  if (!canUseDatabase()) return DEFAULT_PAPER_SETTINGS;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("paper_settings").select("*").eq("id", true).maybeSingle();
  if (error) {
    if (tableMissing(error)) return DEFAULT_PAPER_SETTINGS;
    throw new Error(error.message);
  }
  if (data) return data as PaperTradingSettings;

  const { data: created, error: createError } = await supabase
    .from("paper_settings")
    .insert({ id: true, enabled: false, starting_cash: 100000, allocation_per_trade: 10000 })
    .select("*")
    .single();

  if (createError) {
    if (tableMissing(createError)) return DEFAULT_PAPER_SETTINGS;
    throw new Error(createError.message);
  }

  return created as PaperTradingSettings;
}

export async function setPaperTradingEnabled(enabled: boolean) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("paper_settings")
    .upsert(
      {
        id: true,
        enabled,
        starting_cash: DEFAULT_PAPER_SETTINGS.starting_cash,
        allocation_per_trade: DEFAULT_PAPER_SETTINGS.allocation_per_trade,
        activated_at: enabled ? new Date().toISOString() : null,
      },
      { onConflict: "id" },
    );

  if (error) throw new Error(error.message);
}

export async function listPaperTrades(): Promise<PaperTrade[]> {
  if (!canUseDatabase()) return [];
  const { data, error } = await getSupabaseAdmin().from("paper_trades").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) {
    if (tableMissing(error)) return [];
    throw new Error(error.message);
  }
  return (data || []) as PaperTrade[];
}

export async function getPaperTradingOverview() {
  const [settings, trades, outcomes] = await Promise.all([getPaperTradingSettings(), listPaperTrades(), listOutcomeEvaluations()]);
  const outcomesBySignal = new Map(outcomes.map((outcome) => [outcome.signal_id, outcome]));
  const settled = trades
    .map((trade) => ({ trade, outcome: outcomesBySignal.get(trade.signal_id) }))
    .filter((item) => Number.isFinite(Number(item.outcome?.return_pct)));
  const allocated = trades.reduce((sum, trade) => sum + Number(trade.allocated_cash || 0), 0);
  const activeAllocated = trades
    .filter((trade) => trade.status === "planned" && !Number.isFinite(Number(outcomesBySignal.get(trade.signal_id)?.return_pct)))
    .reduce((sum, trade) => sum + Number(trade.allocated_cash || 0), 0);
  const realizedPnl = settled.reduce((sum, item) => sum + Number(item.trade.allocated_cash || 0) * (Number(item.outcome?.return_pct || 0) / 100), 0);
  const wins = settled.filter((item) => item.outcome?.is_success).length;
  const settledCash = settled.reduce((sum, item) => sum + Number(item.trade.allocated_cash || 0), 0);

  return {
    settings,
    trades,
    activeTrades: trades.filter((trade) => trade.status === "planned" && !Number.isFinite(Number(outcomesBySignal.get(trade.signal_id)?.return_pct))).length,
    settledTrades: settled.length,
    allocated,
    activeAllocated,
    cashAvailable: Number(settings.starting_cash || 0) - activeAllocated,
    realizedPnl,
    paperValue: Number(settings.starting_cash || 0) + realizedPnl,
    returnPct: settledCash ? realizedPnl / settledCash : null,
    hitRate: settled.length ? wins / settled.length : null,
  };
}

function expectationForPaperTrade(mention: Mention, signal: Signal) {
  if (signal.action === "BUY_CANDIDATE") return `${mention.company_name} förväntas stiga${mention.time_horizon ? ` inom ${mention.time_horizon}` : ""}.`;
  return signal.reasoning;
}

export async function createPaperTradesForPost(postId: string) {
  const settings = await getPaperTradingSettings();
  if (!settings.enabled) return { created: 0, skipped: 0 };

  const post = await getPostWithAnalysis(postId);
  const rows = (post.mentions || []).flatMap((mention) =>
    (mention.signals || []).map((signal) => ({ mention, signal })),
  );

  const trades = rows
    .filter(({ mention, signal }) => signal.action === "BUY_CANDIDATE" && Boolean(mention.ticker))
    .flatMap(({ mention, signal }) => {
      const horizonDays = inferHorizonDays(mention.time_horizon);
      if (horizonDays === null) return [];
      const sourceDate = post.published_at || post.created_at;
      const plannedExit = toDateOnly(addDays(new Date(sourceDate), horizonDays));
      return {
        signal_id: signal.id,
        mention_id: mention.id,
        post_id: post.id,
        ticker: mention.ticker!,
        company_name: mention.company_name,
        action: signal.action,
        status: "planned",
        allocated_cash: settings.allocation_per_trade,
        horizon_label: mention.time_horizon,
        horizon_days: horizonDays,
        planned_exit_date: plannedExit,
        thesis: mention.thesis,
        expectation: expectationForPaperTrade(mention, signal),
        risk_level: signal.risk_level,
      };
    });

  if (trades.length === 0) return { created: 0, skipped: rows.length };

  const { error } = await getSupabaseAdmin().from("paper_trades").upsert(trades, { onConflict: "signal_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return { created: trades.length, skipped: rows.length - trades.length };
}
export async function getDashboardStats() {
  const posts = await listDashboardPosts();
  const mentions = posts.flatMap((post) => post.mentions || []);
  const signals = mentions.flatMap((mention) => mention.signals || []);

  return {
    posts: posts.length,
    analyzed: posts.filter((post) => post.processing_status === "analyzed").length,
    failed: posts.filter((post) => post.processing_status === "failed").length,
    mentions: mentions.length,
    buyCandidates: signals.filter((signal) => signal.action === "BUY_CANDIDATE").length,
  };
}

export async function getPostWithAnalysis(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("posts")
    .select("*, creators(username, profile_url), mentions(*, signals(*))")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as DashboardPost;
}

export async function listStockHistory(ticker: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mentions")
    .select("*, signals(*), posts(*, creators(username, profile_url))")
    .or(`ticker.ilike.${ticker},company_name.ilike.${ticker}`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as Array<Mention & { signals?: Signal[]; posts?: DashboardPost }>;
}

export async function createManualTranscriptPost(input: {
  url: string;
  transcript: string;
  caption?: string;
  publishedAt?: string;
}) {
  const creator = await ensureDefaultCreator();
  const tiktokVideoId = extractTikTokVideoId(input.url);
  const platformPostId = tiktokVideoId || (input.url.trim().length > 0 ? `manual:${hashText(input.url)}` : `manual:${hashText(input.transcript)}`);

  if (tiktokVideoId && input.url.trim().length > 0) {
    const { data: existingByUrl, error: existingByUrlError } = await getSupabaseAdmin()
      .from("posts")
      .select("*")
      .eq("creator_id", creator.id)
      .eq("url", input.url)
      .maybeSingle();

    if (existingByUrlError) throw new Error(existingByUrlError.message);

    const existingPost = existingByUrl as Post | null;
    if (existingPost && existingPost.platform_post_id !== platformPostId) {
      const rawMetadata = existingPost.raw_metadata || {};
      const { data, error } = await getSupabaseAdmin()
        .from("posts")
        .update({
          platform_post_id: platformPostId,
          caption: input.caption || existingPost.caption || null,
          published_at: input.publishedAt || existingPost.published_at || null,
          transcript: input.transcript,
          processing_status: "transcribed",
          processing_error: null,
          raw_metadata: { ...rawMetadata, source: "manual_transcript", adopted_platform_post_id: platformPostId },
        })
        .eq("id", existingPost.id)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return data as Post;
    }
  }

  const { data, error } = await getSupabaseAdmin()
    .from("posts")
    .upsert(
      {
        creator_id: creator.id,
        platform_post_id: platformPostId,
        url: input.url || `manual://${platformPostId}`,
        caption: input.caption || null,
        published_at: input.publishedAt || null,
        transcript: input.transcript,
        processing_status: "transcribed",
        processing_error: null,
        raw_metadata: { source: "manual_transcript" },
      },
      { onConflict: "creator_id,platform_post_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Post;
}

function ignoredPostsTableMissing(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("ignored_posts"));
}

async function listIgnoredPostIds(creatorId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("ignored_posts")
    .select("platform_post_id")
    .eq("creator_id", creatorId);

  if (error) {
    if (ignoredPostsTableMissing(error)) return new Set<string>();
    throw new Error(error.message);
  }

  return new Set((data || []).map((row: { platform_post_id: string }) => row.platform_post_id));
}

async function upsertIgnoredSourcePosts(
  posts: Array<{ creatorId: string; post: SourcePost; reason: string }>,
  options: { requireTable: boolean },
) {
  if (posts.length === 0) return { ignored: 0 };

  const { data, error } = await getSupabaseAdmin()
    .from("ignored_posts")
    .upsert(
      posts.map(({ creatorId, post, reason }) => ({
        creator_id: creatorId,
        platform_post_id: post.platformPostId,
        url: post.url || null,
        caption: post.caption || null,
        reason,
        raw_metadata: post.rawMetadata,
      })),
      { onConflict: "creator_id,platform_post_id" },
    )
    .select("id");

  if (error) {
    if (ignoredPostsTableMissing(error) && !options.requireTable) return { ignored: 0 };
    throw new Error("Ignore-listan saknar tabellen ignored_posts. Kör senaste Supabase-migrationen först.");
  }

  return { ignored: (data || []).length };
}

export async function saveSourcePosts(posts: SourcePost[]) {
  const creator = await ensureDefaultCreator();
  if (posts.length === 0) {
    return { found: 0, inserted: 0, skipped: 0, adopted: 0, ignored: 0, irrelevant: 0, insertedPostIds: [] as string[], processPostIds: [] as string[] };
  }

  const supabase = getSupabaseAdmin();
  const ignoredPostIds = await listIgnoredPostIds(creator.id);
  const { data: existing, error: existingError } = await supabase
    .from("posts")
    .select("id, platform_post_id, url, caption, published_at, cover_url, media_url, duration_seconds, processing_status, raw_metadata")
    .eq("creator_id", creator.id);

  if (existingError) throw new Error(existingError.message);
  const existingRows = (existing || []) as Array<
    Pick<
      Post,
      | "id"
      | "platform_post_id"
      | "url"
      | "caption"
      | "published_at"
      | "cover_url"
      | "media_url"
      | "duration_seconds"
      | "processing_status"
      | "raw_metadata"
    >
  >;
  const existingByPlatformId = new Map(existingRows.map((row) => [row.platform_post_id, row]));
  const existingByTikTokId = new Map<string, (typeof existingRows)[number]>();
  const processPostIds = new Set<string>();

  for (const row of existingRows) {
    const tiktokVideoId = extractTikTokVideoId(row.url) || (!row.platform_post_id.startsWith("manual:") ? row.platform_post_id : null);
    if (tiktokVideoId && !existingByTikTokId.has(tiktokVideoId)) existingByTikTokId.set(tiktokVideoId, row);
  }

  const newPosts: SourcePost[] = [];
  const autoIgnoredPosts: Array<{ creatorId: string; post: SourcePost; reason: string }> = [];
  let adopted = 0;
  let ignored = 0;
  let irrelevant = 0;

  for (const post of posts) {
    const tiktokVideoId = extractTikTokVideoId(post.url) || post.platformPostId;
    if (ignoredPostIds.has(post.platformPostId) || ignoredPostIds.has(tiktokVideoId)) {
      ignored += 1;
      continue;
    }

    const relevance = classifySourcePost(post);
    if (!relevance.shouldImport) {
      ignored += 1;
      irrelevant += 1;
      autoIgnoredPosts.push({ creatorId: creator.id, post, reason: relevance.reason || "not_relevant" });
      continue;
    }

    const existingPost = existingByPlatformId.get(post.platformPostId) || existingByTikTokId.get(tiktokVideoId);

    if (!existingPost) {
      newPosts.push(post);
      continue;
    }

    if (existingPost.processing_status !== "analyzed" && existingPost.processing_status !== "processing") {
      processPostIds.add(existingPost.id);
    }

    if (existingPost.platform_post_id !== post.platformPostId) {
      const rawMetadata = (existingPost.raw_metadata || {}) as Record<string, unknown>;
      const { error: updateError } = await supabase
        .from("posts")
        .update({
          platform_post_id: post.platformPostId,
          url: post.url || existingPost.url,
          caption: existingPost.caption || post.caption || null,
          published_at: existingPost.published_at || post.publishedAt || null,
          cover_url: existingPost.cover_url || post.coverUrl || null,
          media_url: existingPost.media_url || post.mediaUrl || null,
          duration_seconds: existingPost.duration_seconds || post.durationSeconds || null,
          raw_metadata: { ...post.rawMetadata, ...rawMetadata, adopted_platform_post_id: post.platformPostId },
          processing_error: null,
        })
        .eq("id", existingPost.id);

      if (updateError) throw new Error(updateError.message);
      adopted += 1;
      existingPost.platform_post_id = post.platformPostId;
      existingByPlatformId.set(post.platformPostId, existingPost);
    }
  }

  await upsertIgnoredSourcePosts(autoIgnoredPosts, { requireTable: false });

  if (newPosts.length === 0) {
    return {
      found: posts.length,
      inserted: 0,
      skipped: posts.length - adopted - ignored,
      adopted,
      ignored,
      irrelevant,
      insertedPostIds: [] as string[],
      processPostIds: Array.from(processPostIds),
    };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert(
      newPosts.map((post) => ({
        creator_id: creator.id,
        platform_post_id: post.platformPostId,
        url: post.url,
        caption: post.caption || null,
        published_at: post.publishedAt || null,
        cover_url: post.coverUrl || null,
        media_url: post.mediaUrl || null,
        duration_seconds: post.durationSeconds || null,
        processing_status: "new",
        raw_metadata: post.rawMetadata,
      })),
    )
    .select("id");

  if (error) throw new Error(error.message);
  const insertedPostIds = (data || []).map((row: { id: string }) => row.id);
  insertedPostIds.forEach((id) => processPostIds.add(id));

  return {
    found: posts.length,
    inserted: newPosts.length,
    skipped: posts.length - newPosts.length - adopted - ignored,
    adopted,
    ignored,
    irrelevant,
    insertedPostIds,
    processPostIds: Array.from(processPostIds),
  };
}

export async function updatePostTranscript(postId: string, transcript: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("posts")
    .update({ transcript, processing_status: "transcribed", processing_error: null })
    .eq("id", postId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Post;
}

export async function updatePostUrl(postId: string, url: string) {
  const { error } = await getSupabaseAdmin()
    .from("posts")
    .update({ url, processing_error: null })
    .eq("id", postId);

  if (error) throw new Error(error.message);
}

export async function setPostStatus(postId: string, status: Post["processing_status"], errorMessage?: string | null) {
  const { error } = await getSupabaseAdmin()
    .from("posts")
    .update({ processing_status: status, processing_error: errorMessage || null })
    .eq("id", postId);

  if (error) throw new Error(error.message);
}

export async function deletePosts(postIds: string[]) {
  const ids = Array.from(new Set(postIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) return { deleted: 0 };

  const { data: postsToDelete, error: selectError } = await getSupabaseAdmin()
    .from("posts")
    .select("creator_id, platform_post_id, url, caption, raw_metadata")
    .in("id", ids);
  if (selectError) throw new Error(selectError.message);

  await upsertIgnoredSourcePosts(
    ((postsToDelete || []) as Array<Pick<Post, "creator_id" | "platform_post_id" | "url" | "caption" | "raw_metadata">>).flatMap((post) => {
      const platformPostIds = new Set([post.platform_post_id, extractTikTokVideoId(post.url)].filter((id): id is string => Boolean(id)));
      return Array.from(platformPostIds).map((platformPostId) => ({
        creatorId: post.creator_id,
        post: {
          platform: "tiktok" as const,
          platformPostId,
          url: post.url,
          caption: post.caption,
          rawMetadata: post.raw_metadata,
        },
        reason: "manual_delete",
      }));
    }),
    { requireTable: true },
  );

  const { data, error } = await getSupabaseAdmin().from("posts").delete().in("id", ids).select("id");
  if (error) throw new Error(error.message);

  return { deleted: (data || []).length };
}

function analysisMetadata(analysis: AnalysisResponse) {
  const summary = analysis.summary.trim();
  const summaryByLevel = Object.fromEntries(
    EXPLAIN_LEVELS.map((level) => [level, analysis.summary_by_level?.[level]?.trim() || summary]),
  );

  return {
    analysis_summary: summary,
    analysis_summary_by_level: summaryByLevel,
    analysis_headline: analysis.headline?.trim() || summary,
    analysis_updated_at: new Date().toISOString(),
  };
}

export async function replacePostAnalysis(postId: string, analysis: AnalysisResponse) {
  const supabase = getSupabaseAdmin();
  const { data: existingPost, error: postError } = await supabase.from("posts").select("raw_metadata").eq("id", postId).single();
  if (postError) throw new Error(postError.message);

  const { error: deleteError } = await supabase.from("mentions").delete().eq("post_id", postId);
  if (deleteError) throw new Error(deleteError.message);

  for (const mention of analysis.mentions) {
    const { data: savedMention, error: mentionError } = await supabase
      .from("mentions")
      .insert({
        post_id: postId,
        company_name: mention.company_name,
        ticker: mention.ticker || null,
        exchange: mention.exchange || null,
        sentiment: mention.sentiment,
        thesis: mention.thesis,
        arguments: mention.arguments,
        risks: mention.risks,
        catalysts: mention.catalysts,
        mentioned_price: mention.mentioned_price || null,
        time_horizon: mention.time_horizon || null,
        confidence: mention.confidence,
      })
      .select("*")
      .single();

    if (mentionError) throw new Error(mentionError.message);

    const { error: signalError } = await supabase.from("signals").insert({
      mention_id: (savedMention as Mention).id,
      action: mention.signal.action,
      reasoning: mention.signal.reasoning,
      entry_condition: mention.signal.entry_condition || null,
      invalidation_condition: mention.signal.invalidation_condition || null,
      risk_level: mention.signal.risk_level,
      confidence: mention.signal.confidence,
    });

    if (signalError) throw new Error(signalError.message);
  }

  const rawMetadata = ((existingPost as Pick<Post, "raw_metadata"> | null)?.raw_metadata || {}) as Record<string, unknown>;
  const { error: updateError } = await supabase
    .from("posts")
    .update({
      processing_status: "analyzed",
      processing_error: null,
      raw_metadata: { ...rawMetadata, ...analysisMetadata(analysis) },
    })
    .eq("id", postId);

  if (updateError) throw new Error(updateError.message);
  await createPaperTradesForPost(postId);
}

export async function tryAcquireLock(key: string, holdSeconds = 300) {
  const { data, error } = await getSupabaseAdmin().rpc("try_acquire_lock", {
    lock_key: key,
    hold_seconds: holdSeconds,
  });

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function releaseLock(key: string) {
  const { error } = await getSupabaseAdmin().rpc("release_lock", { lock_key: key });
  if (error) throw new Error(error.message);
}

export async function writeRunLog(runType: string, status: string, report: Record<string, unknown>) {
  const { error } = await getSupabaseAdmin().from("run_logs").insert({ run_type: runType, status, report });
  if (error) throw new Error(error.message);
}
export async function listOutcomeEvaluations() {
  if (!canUseDatabase()) return [] as Array<OutcomeEvaluation & { signals?: Signal; mentions?: Mention; posts?: Post }>;

  const { data, error } = await getSupabaseAdmin()
    .from("outcome_evaluations")
    .select("*, signals(*), mentions(*), posts(*)")
    .order("evaluated_at", { ascending: false })
    .limit(200);

  if (error) {
    if (error.message.includes("outcome_evaluations")) return [] as Array<OutcomeEvaluation & { signals?: Signal; mentions?: Mention; posts?: Post }>;
    throw new Error(error.message);
  }
  return (data || []) as unknown as Array<OutcomeEvaluation & { signals?: Signal; mentions?: Mention; posts?: Post }>;
}

export async function getAccuracyOverview() {
  const outcomes = await listOutcomeEvaluations();
  const completed = outcomes.filter((outcome) => outcome.is_success !== null && outcome.verdict !== "IGNORED");
  const successes = completed.filter((outcome) => outcome.is_success).length;
  const averageReturn = completed.length
    ? completed.reduce((sum, outcome) => sum + Number(outcome.return_pct || 0), 0) / completed.length
    : 0;

  return {
    outcomes: outcomes.length,
    completed: completed.length,
    pending: outcomes.filter((outcome) => outcome.verdict === "PENDING").length,
    noData: outcomes.filter((outcome) => outcome.verdict === "NO_DATA").length,
    successes,
    hitRate: completed.length ? successes / completed.length : null,
    averageReturn,
  };
}

export async function listSignalsForOutcomeUpdate(postId?: string) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("signals")
    .select("*, mentions(*, posts(*))")
    .order("generated_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data || []) as unknown as Array<Signal & { mentions?: Mention & { posts?: Post } }>;
  return rows.filter((signal) => {
    if (postId && signal.mentions?.post_id !== postId) return false;
    if (signal.action === "INSUFFICIENT_DATA") return false;
    return Boolean(signal.mentions?.ticker && (signal.mentions?.posts?.published_at || signal.mentions?.posts?.created_at));
  });
}

export async function upsertOutcomeEvaluation(input: Omit<OutcomeEvaluation, "id" | "created_at" | "evaluated_at">) {
  const { data, error } = await getSupabaseAdmin()
    .from("outcome_evaluations")
    .upsert(
      {
        signal_id: input.signal_id,
        mention_id: input.mention_id,
        post_id: input.post_id,
        ticker: input.ticker,
        exchange: input.exchange,
        action: input.action,
        horizon_label: input.horizon_label,
        horizon_days: input.horizon_days,
        start_date: input.start_date,
        target_date: input.target_date,
        start_price: input.start_price,
        target_price: input.target_price,
        return_pct: input.return_pct,
        is_success: input.is_success,
        verdict: input.verdict,
        notes: input.notes,
        source: input.source,
        raw_data: input.raw_data,
        evaluated_at: new Date().toISOString(),
      },
      { onConflict: "signal_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as OutcomeEvaluation;
}
