import { describe, expect, it } from "vitest";
import { fallbackTitleFromTranscript } from "../src/lib/title";

describe("fallbackTitleFromTranscript", () => {
  it("uses the first useful transcript sentence as a safe title", () => {
    expect(fallbackTitleFromTranscript("\n\nIdag tittar vi pa bolaget Example AB som kan fa en stark rapport nasta manad. Mer text."))
      .toBe("Idag tittar vi pa bolaget Example AB som kan fa en stark rapport nasta manad.");
  });

  it("keeps generated fallback titles compact", () => {
    const title = fallbackTitleFromTranscript("Detta ar en mycket lang transkription om ett bolag med flera katalysatorer och risker som egentligen inte ska bli en hel paragraf i listan.");
    expect(title.length).toBeLessThanOrEqual(90);
  });
});
