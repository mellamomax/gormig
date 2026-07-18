import { toFile } from "openai/uploads";
import { getOpenAIClient, getTranscribeModel } from "./client";

export async function transcribeMediaUrl(mediaUrl: string) {
  if (!mediaUrl.trim()) throw new Error("Media URL is missing.");

  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch media (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") || "video/mp4";
  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = contentType.includes("audio") ? "mp3" : "mp4";
  const file = await toFile(buffer, `stockrobber.${extension}`, { type: contentType });

  const transcription = await getOpenAIClient().audio.transcriptions.create({
    model: getTranscribeModel(),
    file,
  });

  return transcription.text;
}
