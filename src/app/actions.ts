"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createManualTranscriptPost } from "@/lib/data";
import { analyzePost, scrapeLatestPosts, transcribePost } from "@/lib/jobs/manual-runs";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function addManualTranscriptAction(formData: FormData) {
  const transcript = getString(formData, "transcript");
  if (!transcript) throw new Error("Transkription saknas.");

  const post = await createManualTranscriptPost({
    url: getString(formData, "url"),
    caption: getString(formData, "caption"),
    publishedAt: getString(formData, "publishedAt") || undefined,
    transcript,
  });

  if (getString(formData, "analyzeNow") === "yes") {
    await analyzePost(post.id);
  }

  revalidatePath("/");
  redirect(`/posts/${post.id}`);
}

export async function analyzePostAction(formData: FormData) {
  const postId = getString(formData, "postId");
  if (!postId) throw new Error("Post id saknas.");
  await analyzePost(postId);
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
