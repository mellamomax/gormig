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

export type Signal = {
  id: string;
  mention_id: string;
  action: "BUY_CANDIDATE" | "WATCH" | "HOLD" | "REDUCE" | "AVOID" | "INSUFFICIENT_DATA";
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
  mentions?: Array<Mention & { signals?: Signal[] }>;
};
