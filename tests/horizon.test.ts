import { describe, expect, it } from "vitest";
import { inferHorizonDays } from "../src/lib/market/horizon";

describe("inferHorizonDays", () => {
  it("understands Swedish month horizons and ranges", () => {
    expect(inferHorizonDays("inom 1 månad")).toBe(30);
    expect(inferHorizonDays("2 månader")).toBe(60);
    expect(inferHorizonDays("3-6 månader")).toBe(180);
  });

  it("understands short contextual horizons", () => {
    expect(inferHorizonDays("1 timme")).toBe(1);
    expect(inferHorizonDays("inför rapporten")).toBe(14);
    expect(inferHorizonDays("kortsiktigt")).toBe(14);
  });

  it("does not invent a default when unclear", () => {
    expect(inferHorizonDays(null)).toBeNull();
    expect(inferHorizonDays("oklart")).toBeNull();
  });
});
