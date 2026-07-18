import { describe, expect, it } from "vitest";
import { buildHorizonDecision, buildPositionSize, buildReliability } from "../src/lib/decision";
import type { Mention, Signal } from "../src/lib/types";

const mention: Mention = {
  id: "mention-1",
  post_id: "post-1",
  company_name: "Atlas Copco",
  ticker: "ATCO-A",
  exchange: "STO",
  sentiment: "positive",
  thesis: "Market underestimates the AI exposure.",
  arguments: ["AI demand", "strong order book"],
  risks: ["valuation"],
  catalysts: ["earnings"],
  mentioned_price: null,
  time_horizon: "12 månader",
  confidence: 0.95,
  created_at: "2026-07-16T00:00:00.000Z",
};

const signal: Signal = {
  id: "signal-1",
  mention_id: "mention-1",
  action: "BUY_CANDIDATE",
  reasoning: "Strong setup.",
  entry_condition: null,
  invalidation_condition: null,
  risk_level: "low",
  confidence: 0.96,
  generated_at: "2026-07-16T00:00:00.000Z",
};

describe("decision model", () => {
  it("treats horizon as an evaluation period, not waiting time", () => {
    const horizon = buildHorizonDecision({ mention, signal, publishedAt: "2026-07-16T00:00:00.000Z", createdAt: mention.created_at });

    expect(horizon.bucket).toBe("lång sikt");
    expect(horizon.headline).toBe("Gäller nu: lång sikt");
    expect(horizon.detail).toContain("vänta tills dess");
  });

  it("scores reliability and caps max paper sizing", () => {
    const input = { mention, signal, publishedAt: "2026-07-16T00:00:00.000Z", createdAt: mention.created_at };

    expect(buildReliability(input).score).toBe(5);
    expect(buildPositionSize(input)).toMatchObject({ label: "Max", percent: 20 });
  });

  it("does not allocate paper money without a buy candidate", () => {
    const watchSignal = { ...signal, action: "WATCH" as const };

    expect(buildPositionSize({ mention, signal: watchSignal, publishedAt: null, createdAt: mention.created_at })).toMatchObject({
      label: "Ingen",
      percent: 0,
    });
  });
});
