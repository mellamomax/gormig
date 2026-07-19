import { DEFAULT_EXPLAIN_LEVEL, type ExplainLevel } from "@/lib/explain-level";
import { analyzeTranscript } from "@/lib/openai/analysis";
import { transcribeMediaUrl } from "@/lib/openai/transcribe";
import { transcribeTikTokUrl } from "@/lib/sources/apify-transcript";
import { ApifyTikTokSource } from "@/lib/sources/apify-tiktok";
import {
  getPostWithAnalysis,
  releaseLock,
  replacePostAnalysis,
  saveSourcePosts,
  setPostStatus,
  tryAcquireLock,
  updatePostTranscript,
  updatePostUrl,
  writeRunLog,
} from "@/lib/data";
import { getEnv } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors";
import { extractTikTokVideoId } from "@/lib/tiktok";
import type { DashboardPost } from "@/lib/types";

function usableTikTokUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && /^https?:\/\/(www\.)?tiktok\.com\//i.test(trimmed) ? trimmed : null;
}

function resolveTikTokUrl(post: Pick<DashboardPost, "url" | "platform_post_id">) {
  const currentUrl = usableTikTokUrl(post.url);
  if (currentUrl) return { url: currentUrl, reconstructed: false };

  const videoId = extractTikTokVideoId(post.url) || extractTikTokVideoId(post.platform_post_id);
  if (!videoId) return { url: null, reconstructed: false };

  const username = getEnv("TIKTOK_USERNAME") || "stockrobber";
  return { url: `https://www.tiktok.com/@${username}/video/${videoId}`, reconstructed: true };
}

async function transcriptForPost(post: DashboardPost) {
  const resolved = resolveTikTokUrl(post);
  if (getEnv("APIFY_TRANSCRIPT_ACTOR_ID") && resolved.url) {
    if (resolved.reconstructed && resolved.url !== post.url) await updatePostUrl(post.id, resolved.url);
    return transcribeTikTokUrl(resolved.url);
  }

  if (post.media_url) return transcribeMediaUrl(post.media_url);
  return null;
}

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

  await setPostStatus(postId, "processing");
  try {
    const transcript = await transcriptForPost(post);

    if (!transcript) {
      throw new Error("Kunde inte hitta en TikTok-länk att transkribera. Lägg in URL manuellt eller scrapea om videon.");
    }

    const updated = await updatePostTranscript(postId, transcript);
    await writeRunLog("manual_analysis", "completed", { postId, transcribed: true });
    return updated;
  } catch (error) {
    await setPostStatus(postId, "failed", getErrorMessage(error));
    await writeRunLog("manual_analysis", "failed", { postId, error: getErrorMessage(error) });
    throw error;
  }
}

export async function processPost(postId: string, explainLevel: ExplainLevel = DEFAULT_EXPLAIN_LEVEL) {
  const post = await getPostWithAnalysis(postId);

  await setPostStatus(postId, "processing");
  try {
    let transcript = post.transcript;
    let transcribed = false;

    if (!transcript) {
      transcript = await transcriptForPost(post);

      if (!transcript) {
        throw new Error("Kunde inte hitta en TikTok-länk att transkribera. Lägg in URL manuellt eller scrapea om videon.");
      }

      await updatePostTranscript(postId, transcript);
      transcribed = true;
    }

    const analysis = await analyzeTranscript(transcript, explainLevel);
    await replacePostAnalysis(postId, analysis);
    const report = { postId, explainLevel, transcribed, analyzed: true, mentions: analysis.mentions.length };
    await writeRunLog("manual_analysis", "completed", report);
    return report;
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
    const processErrors: string[] = [];
    let processed = 0;

    for (const postId of result.processPostIds) {
      try {
        await processPost(postId);
        processed += 1;
      } catch (error) {
        processErrors.push(getErrorMessage(error));
      }
    }

    const report = {
      ...result,
      processed,
      processFailed: processErrors.length,
      processErrors,
    };
    await writeRunLog("manual_scrape", processErrors.length ? "failed" : "completed", { limit: safeLimit, ...report });
    return report;
  } catch (error) {
    await writeRunLog("manual_scrape", "failed", { limit: safeLimit, error: getErrorMessage(error) });
    throw error;
  } finally {
    await releaseLock(lockKey);
  }
}
