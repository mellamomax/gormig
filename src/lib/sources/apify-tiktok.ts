import { createHash } from "crypto";
import { getEnv, requireEnv } from "@/lib/env";
import type { SourcePost } from "@/lib/types";
import type { SocialMediaSource } from "./social";

function hash(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 20);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getPath(item: Record<string, unknown>, path: string[]) {
  let current: unknown = item;
  for (const key of path) {
    current = asRecord(current)[key];
  }
  return current;
}

function firstString(item: Record<string, unknown>, paths: string[][]) {
  for (const path of paths) {
    const value = getPath(item, path);
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function firstNumber(item: Record<string, unknown>, paths: string[][]) {
  for (const path of paths) {
    const value = getPath(item, path);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 1000000000) {
    return new Date(numeric * (numeric > 9999999999 ? 1 : 1000)).toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

export function normalizeApifyTikTokItem(item: unknown): SourcePost | null {
  const record = asRecord(item);
  const url = firstString(record, [
    ["webVideoUrl"],
    ["url"],
    ["shareUrl"],
    ["videoUrl"],
    ["video", "url"],
  ]);

  if (!url) return null;

  const id = firstString(record, [
    ["id"],
    ["aweme_id"],
    ["video", "id"],
    ["videoId"],
  ]) || hash(url);

  const created = firstString(record, [
    ["createTimeISO"],
    ["createTime"],
    ["createdAt"],
    ["publishedAt"],
    ["timestamp"],
  ]);

  return {
    platform: "tiktok",
    platformPostId: id,
    url,
    caption: firstString(record, [["text"], ["description"], ["desc"], ["caption"]]),
    publishedAt: normalizeDate(created),
    coverUrl: firstString(record, [["videoMeta", "coverUrl"], ["coverUrl"], ["thumbnail"], ["covers", "default"]]),
    mediaUrl: firstString(record, [["videoMeta", "downloadAddr"], ["videoMeta", "playAddr"], ["downloadUrl"], ["mediaUrl"]]),
    durationSeconds: firstNumber(record, [["videoMeta", "duration"], ["duration"], ["durationSeconds"]]),
    rawMetadata: record,
  };
}

export class ApifyTikTokSource implements SocialMediaSource {
  constructor(private readonly options: { username: string; limit: number }) {}

  async fetchLatestPosts(): Promise<SourcePost[]> {
    const actorId = requireEnv("APIFY_ACTOR_ID");
    const token = requireEnv("APIFY_API_TOKEN");
    const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=120`;
    const profileUrl = `https://www.tiktok.com/@${this.options.username}`;
    const customInput = getEnv("APIFY_ACTOR_INPUT_JSON");
    const input = customInput
      ? { ...JSON.parse(customInput), maxItems: this.options.limit }
      : {
          startUrls: [{ url: profileUrl }],
          profiles: [this.options.username],
          maxItems: this.options.limit,
          resultsPerPage: this.options.limit,
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
        };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Apify request failed (${response.status}): ${body.slice(0, 500)}`);
    }

    const json = (await response.json()) as unknown;
    if (!Array.isArray(json)) {
      throw new Error("Apify returned an unexpected response. Expected dataset items array.");
    }

    return json.map(normalizeApifyTikTokItem).filter((post): post is SourcePost => Boolean(post)).slice(0, this.options.limit);
  }
}
