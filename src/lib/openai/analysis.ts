import { analysisResponseSchema, type AnalysisResponse } from "@/lib/schemas";
import { getAnalysisModel, getOpenAIClient } from "./client";

const SYSTEM_PROMPT = `You analyze TikTok transcripts for a private investing research dashboard.
Return Swedish explanations but keep enum values exactly as specified.
This is research support, not financial advice. Never present conclusions as certain predictions.
Only identify companies, tickers, exchanges, thesis, arguments, risks, catalysts, price levels, time horizon, confidence, and a cautious signal.
Signal actions allowed: BUY_CANDIDATE, WATCH, HOLD, REDUCE, AVOID, INSUFFICIENT_DATA.
Every signal must include concrete reasoning and risk_level.`;

function buildUserPrompt(transcript: string) {
  return `Analyze this transcript and return only valid JSON with this shape:
{
  "summary": "short Swedish summary",
  "mentions": [
    {
      "company_name": "string",
      "ticker": "string or null",
      "exchange": "string or null",
      "sentiment": "positive|negative|neutral",
      "thesis": "string",
      "arguments": ["string"],
      "risks": ["string"],
      "catalysts": ["string"],
      "mentioned_price": "string or null",
      "time_horizon": "string or null",
      "confidence": 0.0,
      "signal": {
        "action": "BUY_CANDIDATE|WATCH|HOLD|REDUCE|AVOID|INSUFFICIENT_DATA",
        "reasoning": "string",
        "entry_condition": "string or null",
        "invalidation_condition": "string or null",
        "risk_level": "low|medium|high|unknown",
        "confidence": 0.0
      }
    }
  ],
  "no_mention_reason": "string or null"
}

Transcript:
${transcript}`;
}

export async function analyzeTranscript(transcript: string): Promise<AnalysisResponse> {
  if (!transcript.trim()) throw new Error("Transcript is empty.");

  const client = getOpenAIClient();
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const completion = await client.chat.completions.create({
      model: getAnalysisModel(),
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(transcript) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      lastError = new Error("OpenAI returned an empty response.");
      continue;
    }

    try {
      return analysisResponseSchema.parse(JSON.parse(content));
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`OpenAI response failed validation after retries: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
}
