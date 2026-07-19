import { getEnv, requireEnv } from "@/lib/env";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function joinTextSegments(value: unknown) {
  if (!Array.isArray(value)) return null;
  const text = value
    .map((segment) => firstString(asRecord(segment), ["text", "transcript"]))
    .filter(Boolean)
    .join(" ")
    .trim();

  return text.length > 0 ? text : null;
}

function transcriptFromItem(item: unknown) {
  const record = asRecord(item);
  const direct = firstString(record, ["transcript", "text", "transcript_only_text", "transcription", "transcriptText"]);
  if (direct) return direct;

  const segmentText = joinTextSegments(record.segments) || joinTextSegments(record.transcript);
  if (segmentText) return segmentText;

  if (Array.isArray(record.transcripts)) {
    for (const transcript of record.transcripts) {
      const text = firstString(asRecord(transcript), ["text", "transcript"]);
      if (text) return text;
    }
  }

  return null;
}

function errorFromItem(item: unknown) {
  const record = asRecord(item);
  return firstString(record, ["error", "message", "videoError", "statusText"]) || null;
}

export async function transcribeTikTokUrl(videoUrl: string) {
  if (!videoUrl.trim()) throw new Error("TikTok-länk saknas.");

  const actorId = requireEnv("APIFY_TRANSCRIPT_ACTOR_ID");
  const token = requireEnv("APIFY_API_TOKEN");
  const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=300`;
  const customInput = getEnv("APIFY_TRANSCRIPT_ACTOR_INPUT_JSON");
  const input = customInput ? { ...JSON.parse(customInput), tiktokUrl: videoUrl } : { tiktokUrl: videoUrl };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Apify transcript request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const json = (await response.json()) as unknown;
  if (!Array.isArray(json)) {
    throw new Error("Apify transcript actor returned an unexpected response. Expected dataset items array.");
  }

  const errors: string[] = [];
  for (const item of json) {
    const transcript = transcriptFromItem(item);
    if (transcript) return transcript;

    const error = errorFromItem(item);
    if (error) errors.push(error);
  }

  throw new Error(errors.length ? `Transcript actor returned no transcript: ${errors.join(" / ")}` : "Transcript actor returned no transcript.");
}
