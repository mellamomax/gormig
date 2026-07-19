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

  await setPostStatus(postId, "processing");
  try {
    const transcript = getEnv("APIFY_TRANSCRIPT_ACTOR_ID")
      ? await transcribeTikTokUrl(post.url)
      : post.media_url
        ? await transcribeMediaUrl(post.media_url)
        : null;

    if (!transcript) {
      throw new Error("APIFY_TRANSCRIPT_ACTOR_ID saknas. Lägg in transcript-actorns id i Vercel för automatisk transkribering.");
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
      transcript = getEnv("APIFY_TRANSCRIPT_ACTOR_ID")
        ? await transcribeTikTokUrl(post.url)
        : post.media_url
          ? await transcribeMediaUrl(post.media_url)
          : null;

      if (!transcript) {
        throw new Error("APIFY_TRANSCRIPT_ACTOR_ID saknas. Lägg in transcript-actorns id i Vercel för automatisk transkribering.");
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
