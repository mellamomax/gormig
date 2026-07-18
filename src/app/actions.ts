"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createManualTranscriptPost } from "@/lib/data";
import { parseExplainLevel } from "@/lib/explain-level";
import { getErrorMessage } from "@/lib/errors";
import { analyzePost, scrapeLatestPosts, transcribePost } from "@/lib/jobs/manual-runs";
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

export async function scrapePostsAction(formData: FormData) {
  const limit = Number(getString(formData, "limit") || "5");
  await scrapeLatestPosts(limit);
  revalidatePath("/");
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
