import { describe, expect, it } from "vitest";
import { inferHorizonDays } from "../src/lib/market/horizon";

describe("inferHorizonDays", () => {
  it("understands Swedish month horizons", () => {
    expect(inferHorizonDays("inom 1 månad")).toBe(30);
    expect(inferHorizonDays("2 månader")).toBe(60);
  });

  it("falls back to 30 days when unclear", () => {
    expect(inferHorizonDays(null)).toBe(30);
    expect(inferHorizonDays("oklart")).toBe(30);
  });
});
