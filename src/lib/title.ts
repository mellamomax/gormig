import { getAnalysisModel, getOpenAIClient, hasOpenAIConfig } from "@/lib/openai/client";

const MAX_TITLE_LENGTH = 90;

function firstUsefulLine(transcript: string) {
  return transcript
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find((part) => part.length >= 12);
}

function clampTitle(title: string) {
  const normalized = title
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= MAX_TITLE_LENGTH) return normalized;
  const clipped = normalized.slice(0, MAX_TITLE_LENGTH).replace(/\s+\S*$/, "").trim();
  return clipped || normalized.slice(0, MAX_TITLE_LENGTH).trim();
}

export function fallbackTitleFromTranscript(transcript: string) {
  const line = firstUsefulLine(transcript);
  if (!line) return "Manuell transkription";
  return clampTitle(line);
}

export async function generateTitleFromTranscript(transcript: string) {
  const fallback = fallbackTitleFromTranscript(transcript);

  if (!hasOpenAIConfig()) return fallback;

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: getAnalysisModel(),
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Create concise Swedish titles for private investing research notes. Return only the title, no quotes, no markdown.",
        },
        {
          role: "user",
          content: `Write a factual title of max 9 words based on this TikTok transcript. Prefer the main company/ticker and thesis.\n\nTranscript:\n${transcript.slice(0, 5000)}`,
        },
      ],
    });

    const title = completion.choices[0]?.message?.content;
    return title ? clampTitle(title) : fallback;
  } catch {
    return fallback;
  }
}
