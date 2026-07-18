import { DEFAULT_EXPLAIN_LEVEL, getExplainLevelPrompt, type ExplainLevel } from "@/lib/explain-level";
import { analysisResponseSchema, type AnalysisResponse } from "@/lib/schemas";
import { getAnalysisModel, getOpenAIClient } from "./client";

const SYSTEM_PROMPT = `You analyze TikTok transcripts for a private investing research dashboard.
Return Swedish explanations but keep enum values exactly as specified.
This is research support, not financial advice. Never present conclusions as certain predictions.
Keep answers short by default. Only mention what is actually supported by the transcript.
Signal actions allowed: BUY_CANDIDATE, WATCH, HOLD, REDUCE, AVOID, INSUFFICIENT_DATA.
Every signal must include concrete reasoning and risk_level.
Time horizon is critical for follow-up accuracy: infer it from explicit wording or strong contextual clues in the transcript, but never invent a default horizon.`;

function buildUserPrompt(transcript: string, explainLevel: ExplainLevel) {
  return `Analyze this transcript and return only valid JSON with this shape:
{
  "summary": "short Swedish summary for age 10",
  "headline": "very short Swedish subtitle, max 8 words",
  "summary_by_level": {
    "3": "summary for a 3 year old",
    "5": "summary for a 5 year old",
    "10": "summary for a 10 year old",
    "20": "summary for a 20 year old",
    "expert": "summary for an investing expert"
  },
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

Style level:
${getExplainLevelPrompt(explainLevel)}

Hard rules:
- Use simple Swedish for every non-enum text field.
- Prefer one mention unless the transcript clearly discusses several stocks.
- Keep thesis, reasoning, arguments, risks, and catalysts very short.
- Always fill summary_by_level for all five levels. These summaries will be saved and switched in the UI without rerunning analysis.
- Make headline sound like a compact subtitle for a video list, for example "Atlas Copco är på gång".
- Set time_horizon from what the video says or strongly implies, including between-the-lines clues such as "before earnings", "today", "soon", "short term", "long term", "next week", or "over the coming year".
- Use a concrete Swedish horizon like "1 dag", "2 veckor", "3-6 månader", "inför rapporten", "kortsiktigt", or "långsiktigt" when supported.
- If the horizon is not supported by the transcript, set time_horizon to null. Never default to 1 month.
- If the transcript does not support a clear stock signal, use INSUFFICIENT_DATA.

Transcript:
${transcript}`;
}

export async function analyzeTranscript(transcript: string, explainLevel: ExplainLevel = DEFAULT_EXPLAIN_LEVEL): Promise<AnalysisResponse> {
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
        { role: "user", content: buildUserPrompt(transcript, explainLevel) },
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
