"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createManualTranscriptPost } from "@/lib/data";
import { parseExplainLevel } from "@/lib/explain-level";
import { analyzePost, scrapeLatestPosts, transcribePost } from "@/lib/jobs/manual-runs";
import { updateOutcomeEvaluations } from "@/lib/jobs/outcomes";
import { generateTitleFromTranscript } from "@/lib/title";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
  await updateOutcomeEvaluations(postId);
  revalidatePath("/");
  if (postId) revalidatePath(`/posts/${postId}`);
}
