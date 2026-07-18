import { describe, expect, it } from "vitest";
import { analysisResponseSchema } from "../src/lib/schemas";

describe("analysisResponseSchema", () => {
  it("accepts a cautious structured analysis", () => {
    const parsed = analysisResponseSchema.parse({
      summary: "Kort sammanfattning.",
      mentions: [
        {
          company_name: "Example AB",
          ticker: "EXAB",
          exchange: "STO",
          sentiment: "positive",
          thesis: "Bolaget nämns positivt men osäkerheten är hög.",
          arguments: ["Stark tillväxt"],
          risks: ["Hög värdering"],
          catalysts: ["Rapport"],
          mentioned_price: null,
          time_horizon: "3-6 månader",
          confidence: 0.62,
          signal: {
            action: "WATCH",
            reasoning: "Det finns en tes, men riskerna behöver följas innan beslut.",
            entry_condition: "Bekräftad rapportstyrka",
            invalidation_condition: "Svag guidning",
            risk_level: "medium",
            confidence: 0.55,
          },
        },
      ],
      no_mention_reason: null,
    });

    expect(parsed.mentions[0].signal.action).toBe("WATCH");
  });

  it("rejects signals without reasoning", () => {
    expect(() =>
      analysisResponseSchema.parse({
        summary: "x",
        mentions: [
          {
            company_name: "Example AB",
            sentiment: "neutral",
            thesis: "En tillräckligt lång tes här.",
            arguments: [],
            risks: [],
            catalysts: [],
            confidence: 0.5,
            signal: {
              action: "WATCH",
              reasoning: "kort",
              risk_level: "unknown",
              confidence: 0.5,
            },
          },
        ],
      }),
    ).toThrow();
  });
});
