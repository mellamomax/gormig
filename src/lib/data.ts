import { createHash } from "crypto";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase/server";
import type { AnalysisResponse } from "@/lib/schemas";
import type { Creator, DashboardPost, Mention, OutcomeEvaluation, Post, Signal, SourcePost } from "@/lib/types";

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
  const platformPostId = input.url.trim().length > 0 ? `manual:${hashText(input.url)}` : `manual:${hashText(input.transcript)}`;
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

export async function saveSourcePosts(posts: SourcePost[]) {
  const creator = await ensureDefaultCreator();
  if (posts.length === 0) {
    return { found: 0, inserted: 0, skipped: 0 };
  }

  const supabase = getSupabaseAdmin();
  const ids = posts.map((post) => post.platformPostId);
  const { data: existing, error: existingError } = await supabase
    .from("posts")
    .select("platform_post_id")
    .eq("creator_id", creator.id)
    .in("platform_post_id", ids);

  if (existingError) throw new Error(existingError.message);
  const existingIds = new Set((existing || []).map((row: { platform_post_id: string }) => row.platform_post_id));
  const newPosts = posts.filter((post) => !existingIds.has(post.platformPostId));

  if (newPosts.length === 0) {
    return { found: posts.length, inserted: 0, skipped: posts.length };
  }

  const { error } = await supabase.from("posts").insert(
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
  );

  if (error) throw new Error(error.message);
  return { found: posts.length, inserted: newPosts.length, skipped: posts.length - newPosts.length };
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

export async function setPostStatus(postId: string, status: Post["processing_status"], errorMessage?: string | null) {
  const { error } = await getSupabaseAdmin()
    .from("posts")
    .update({ processing_status: status, processing_error: errorMessage || null })
    .eq("id", postId);

  if (error) throw new Error(error.message);
}

export async function replacePostAnalysis(postId: string, analysis: AnalysisResponse) {
  const supabase = getSupabaseAdmin();
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

  await setPostStatus(postId, "analyzed");
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
    return Boolean(signal.mentions?.ticker && signal.mentions?.posts?.published_at);
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
