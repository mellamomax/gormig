export type ProcessingStatus = "new" | "processing" | "transcribed" | "analyzed" | "failed";

export type Creator = {
  id: string;
  platform: "tiktok";
  username: string;
  profile_url: string;
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: string;
  creator_id: string;
  platform_post_id: string;
  url: string;
  caption: string | null;
  published_at: string | null;
  cover_url: string | null;
  media_url: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  raw_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Mention = {
  id: string;
  post_id: string;
  company_name: string;
  ticker: string | null;
  exchange: string | null;
  sentiment: "positive" | "negative" | "neutral";
  thesis: string;
  arguments: string[];
  risks: string[];
  catalysts: string[];
  mentioned_price: string | null;
  time_horizon: string | null;
  confidence: number;
  created_at: string;
};

export type OutcomeEvaluation = {
  id: string;
  signal_id: string;
  mention_id: string;
  post_id: string;
  ticker: string;
  exchange: string | null;
  action: SignalAction;
  horizon_label: string | null;
  horizon_days: number | null;
  start_date: string | null;
  target_date: string | null;
  start_price: number | null;
  target_price: number | null;
  return_pct: number | null;
  is_success: boolean | null;
  verdict: "PENDING" | "NO_DATA" | "POSITIVE_HIT" | "NEGATIVE_HIT" | "NEUTRAL_HIT" | "MISS" | "IGNORED";
  notes: string | null;
  source: string;
  raw_data: Record<string, unknown>;
  evaluated_at: string;
  created_at: string;
};

export type SignalAction = "BUY_CANDIDATE" | "WATCH" | "HOLD" | "REDUCE" | "AVOID" | "INSUFFICIENT_DATA";
export type PaperTradingSettings = {
  id: boolean;
  enabled: boolean;
  starting_cash: number;
  allocation_per_trade: number;
  activated_at: string | null;
  updated_at: string;
};

export type PaperTrade = {
  id: string;
  signal_id: string;
  mention_id: string;
  post_id: string;
  ticker: string;
  company_name: string;
  action: SignalAction;
  status: "planned" | "settled" | "ignored";
  allocated_cash: number;
  horizon_label: string | null;
  horizon_days: number | null;
  planned_entry_at: string;
  planned_exit_date: string | null;
  thesis: string | null;
  expectation: string | null;
  risk_level: string | null;
  created_at: string;
  updated_at: string;
};

export type Signal = {
  id: string;
  mention_id: string;
  action: SignalAction;
  reasoning: string;
  entry_condition: string | null;
  invalidation_condition: string | null;
  risk_level: "low" | "medium" | "high" | "unknown";
  confidence: number;
  generated_at: string;
};

export type SourcePost = {
  platform: "tiktok";
  platformPostId: string;
  url: string;
  caption?: string | null;
  publishedAt?: string | null;
  coverUrl?: string | null;
  mediaUrl?: string | null;
  durationSeconds?: number | null;
  rawMetadata: Record<string, unknown>;
};

export type DashboardPost = Post & {
  creator?: Pick<Creator, "username" | "profile_url"> | null;
  mentions?: Array<Mention & { signals?: Array<Signal & { outcome_evaluations?: OutcomeEvaluation[] }> }>;
};
