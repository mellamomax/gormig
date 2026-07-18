import { DEFAULT_EXPLAIN_LEVEL, type ExplainLevel } from "@/lib/explain-level";
import { analyzeTranscript } from "@/lib/openai/analysis";
import { transcribeMediaUrl } from "@/lib/openai/transcribe";
import { ApifyTikTokSource } from "@/lib/sources/apify-tiktok";
import {
  getPostWithAnalysis,
  releaseLock,
  replacePostAnalysis,
  saveSourcePosts,
  setPostStatus,
  tryAcquireLock,
  updatePostTranscript,
  writeRunLog,
} from "@/lib/data";
import { getEnv } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors";

export async function analyzePost(postId: string, explainLevel: ExplainLevel = DEFAULT_EXPLAIN_LEVEL) {
  const post = await getPostWithAnalysis(postId);
  if (!post.transcript) throw new Error("Post has no transcript to analyze.");

  await setPostStatus(postId, "processing");
  try {
    const analysis = await analyzeTranscript(post.transcript, explainLevel);
    await replacePostAnalysis(postId, analysis);
    await writeRunLog("manual_analysis", "completed", { postId, explainLevel, mentions: analysis.mentions.length });
    return analysis;
  } catch (error) {
    await setPostStatus(postId, "failed", getErrorMessage(error));
    await writeRunLog("manual_analysis", "failed", { postId, error: getErrorMessage(error) });
    throw error;
  }
}

export async function transcribePost(postId: string) {
  const post = await getPostWithAnalysis(postId);
  if (!post.media_url) throw new Error("Post has no media URL to transcribe.");

  await setPostStatus(postId, "processing");
  try {
    const transcript = await transcribeMediaUrl(post.media_url);
    const updated = await updatePostTranscript(postId, transcript);
    await writeRunLog("manual_analysis", "completed", { postId, transcribed: true });
    return updated;
  } catch (error) {
    await setPostStatus(postId, "failed", getErrorMessage(error));
    await writeRunLog("manual_analysis", "failed", { postId, error: getErrorMessage(error) });
    throw error;
  }
}

export async function scrapeLatestPosts(limit: number) {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const lockKey = "manual_scrape";
  const acquired = await tryAcquireLock(lockKey, 300);

  if (!acquired) {
    throw new Error("A scrape is already running. Try again in a few minutes.");
  }

  try {
    const source = new ApifyTikTokSource({
      username: getEnv("TIKTOK_USERNAME") || "stockrobber",
      limit: safeLimit,
    });
    const posts = await source.fetchLatestPosts();
    const result = await saveSourcePosts(posts);
    await writeRunLog("manual_scrape", "completed", { limit: safeLimit, ...result });
    return result;
  } catch (error) {
    await writeRunLog("manual_scrape", "failed", { limit: safeLimit, error: getErrorMessage(error) });
    throw error;
  } finally {
    await releaseLock(lockKey);
  }
}
