import { describe, expect, it } from "vitest";
import { classifySourcePost } from "../src/lib/relevance";
import type { SourcePost } from "../src/lib/types";

function post(caption: string, rawMetadata: Record<string, unknown> = {}): SourcePost {
  return {
    platform: "tiktok",
    platformPostId: "1",
    url: "https://www.tiktok.com/@stockrobber.com/video/1",
    caption,
    rawMetadata,
  };
}

describe("classifySourcePost", () => {
  it("skips obvious pinned or promo videos before transcription", () => {
    expect(classifySourcePost(post("Återigen utsedd till Sveriges största på Patreon, enligt TV4 Nyhetsmorgon. #aktier #börsen #finans")).shouldImport).toBe(false);
    expect(classifySourcePost(post("Gästar SVT ekonomibyrån. #aktier #börsen #SVT #ekonomi")).shouldImport).toBe(false);
  });

  it("skips videos without finance context", () => {
    expect(classifySourcePost(post("Helgresa och lite vardag bakom kulisserna")).shouldImport).toBe(false);
  });

  it("keeps videos with actual stock-analysis hints", () => {
    expect(classifySourcePost(post("Atlas Copco ser undervärderad ut inför rapport. Risk och trigger i videon. #aktier")).shouldImport).toBe(true);
  });

  it("skips videos when the scraper marks them as pinned", () => {
    expect(classifySourcePost(post("Aktier och börsen", { isPinned: true })).shouldImport).toBe(false);
  });
});
