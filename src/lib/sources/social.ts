import type { SourcePost } from "@/lib/types";

export interface SocialMediaSource {
  fetchLatestPosts(): Promise<SourcePost[]>;
}
