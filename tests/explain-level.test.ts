import { describe, expect, it } from "vitest";
import { DEFAULT_EXPLAIN_LEVEL, getExplainLevelPrompt, parseExplainLevel } from "../src/lib/explain-level";

describe("explain levels", () => {
  it("falls back to the default level for unknown input", () => {
    expect(parseExplainLevel("advanced-but-weird")).toBe(DEFAULT_EXPLAIN_LEVEL);
  });

  it("keeps expert and child prompts distinct", () => {
    expect(getExplainLevelPrompt("3")).toContain("3 years old");
    expect(getExplainLevelPrompt("expert")).toContain("investing expert");
  });
});
