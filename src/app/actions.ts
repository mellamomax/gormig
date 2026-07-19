"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createManualTranscriptPost, deletePosts, setPaperTradingEnabled } from "@/lib/data";
import { parseExplainLevel } from "@/lib/explain-level";
import { getErrorMessage } from "@/lib/errors";
import { analyzePost, processPost, scrapeLatestPosts, transcribePost } from "@/lib/jobs/manual-runs";
import { updateOutcomeEvaluations } from "@/lib/jobs/outcomes";
import { generateTitleFromTranscript } from "@/lib/title";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function outcomeErrorUrl(postId: string | undefined, error: unknown) {
  const message = encodeURIComponent(getErrorMessage(error).slice(0, 500));
  return postId
    ? `/posts/${postId}?outcomeError=1&outcomeMessage=${message}`
    : `/?tab=outcomes&outcomeError=1&outcomeMessage=${message}`;
}

function outcomeReportUrl(postId: string | undefined, report: Awaited<ReturnType<typeof updateOutcomeEvaluations>>) {
  const params = new URLSearchParams({
    outcomeStatus: "1",
    checked: String(report.checked),
    updated: String(report.updated),
    pending: String(report.pending),
    skipped: String(report.skipped),
    noData: String(report.noData),
    failed: String(report.failed),
  });
  const errors = report.errors
    .slice(0, 3)
    .map((error) => (error.length > 220 ? `${error.slice(0, 220)}...` : error))
    .join(" | ");
  if (errors) params.set("errors", errors);

  return postId ? `/posts/${postId}?${params}` : `/?tab=outcomes&${params}`;
}

function scrapeErrorUrl(error: unknown) {
  const message = encodeURIComponent(getErrorMessage(error).slice(0, 500));
  return `/?tab=scrape&scrapeError=1&scrapeMessage=${message}`;
}

function scrapeReportUrl(report: Awaited<ReturnType<typeof scrapeLatestPosts>>) {
  const params = new URLSearchParams({
    tab: "scrape",
    scrapeStatus: "1",
    found: String(report.found),
    inserted: String(report.inserted),
    skipped: String(report.skipped),
    adopted: String(report.adopted),
    ignored: String(report.ignored),
    irrelevant: String(report.irrelevant),
    processed: String(report.processed),
    processFailed: String(report.processFailed),
  });
  const errors = report.processErrors
    .slice(0, 3)
    .map((error) => (error.length > 220 ? `${error.slice(0, 220)}...` : error))
    .join(" | ");
  if (errors) params.set("processErrors", errors);

  return `/?${params}`;
}

function deleteReportUrl(deleted: number) {
  return `/?tab=videos&deleteStatus=1&deleted=${deleted}`;
}

function deleteErrorUrl(error: unknown) {
  const message = encodeURIComponent(getErrorMessage(error).slice(0, 500));
  return `/?tab=videos&deleteError=1&deleteMessage=${message}`;
}

export async function addManualTranscriptAction(formData: FormData) {
  const transcript = getString(formData, "transcript");
  if (!transcript) throw new Error("Transkription saknas.");

  const caption = getString(formData, "caption") || (await generateTitleFromTranscript(transcript));

  const post = await createManualTranscriptPost({
    url: getString(formData, "url"),
    caption,
    publishedAt: getString(formData, "publishedAt") || undefined,
    transcript,
  });

  if (getString(formData, "analyzeNow") === "yes") {
    await analyzePost(post.id, parseExplainLevel(getString(formData, "explainLevel")));
  }

  revalidatePath("/");
  redirect(`/posts/${post.id}`);
}

export async function analyzePostAction(formData: FormData) {
  const postId = getString(formData, "postId");
  if (!postId) throw new Error("Post id saknas.");
  await analyzePost(postId, parseExplainLevel(getString(formData, "explainLevel")));
  revalidatePath("/");
  revalidatePath(`/posts/${postId}`);
}

export async function transcribePostAction(formData: FormData) {
  const postId = getString(formData, "postId");
  if (!postId) throw new Error("Post id saknas.");
  await transcribePost(postId);
  revalidatePath("/");
  revalidatePath(`/posts/${postId}`);
}

export async function deletePostsAction(formData: FormData) {
  const postIds = formData.getAll("postId").filter((value): value is string => typeof value === "string");
  let report: Awaited<ReturnType<typeof deletePosts>>;

  try {
    report = await deletePosts(postIds);
    revalidatePath("/");
  } catch (error) {
    console.error("Delete posts failed", { message: getErrorMessage(error) });
    redirect(deleteErrorUrl(error));
  }

  redirect(deleteReportUrl(report.deleted));
}

export async function processPostAction(formData: FormData) {
  const postId = getString(formData, "postId");
  if (!postId) throw new Error("Post id saknas.");

  try {
    await processPost(postId, parseExplainLevel(getString(formData, "explainLevel")));
    revalidatePath("/");
    revalidatePath(`/posts/${postId}`);
  } catch (error) {
    console.error("Manual post processing failed", { postId, message: getErrorMessage(error) });
    redirect(`/posts/${postId}?processError=1&processMessage=${encodeURIComponent(getErrorMessage(error).slice(0, 500))}`);
  }

  redirect(`/posts/${postId}?processStatus=1`);
}

export async function scrapePostsAction(formData: FormData) {
  const limit = Number(getString(formData, "limit") || "5");
  let report: Awaited<ReturnType<typeof scrapeLatestPosts>>;

  try {
    report = await scrapeLatestPosts(limit);
    revalidatePath("/");
  } catch (error) {
    console.error("Manual scrape failed", { limit, message: getErrorMessage(error) });
    redirect(scrapeErrorUrl(error));
  }

  redirect(scrapeReportUrl(report));
}

export async function updateOutcomesAction(formData: FormData) {
  const postId = getString(formData, "postId") || undefined;
  let report: Awaited<ReturnType<typeof updateOutcomeEvaluations>>;

  try {
    report = await updateOutcomeEvaluations(postId);
    revalidatePath("/");
    if (postId) revalidatePath(`/posts/${postId}`);
  } catch (error) {
    console.error("Outcome update failed", { postId, message: getErrorMessage(error) });
    redirect(outcomeErrorUrl(postId, error));
  }

  console.info("Outcome update completed", { postId, report });
  redirect(outcomeReportUrl(postId, report));
}
export async function togglePaperTradingAction(formData: FormData) {
  const enabled = getString(formData, "enabled") === "yes";
  await setPaperTradingEnabled(enabled);
  revalidatePath("/");
  redirect("/?tab=paper");
}
