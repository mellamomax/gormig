import { describe, expect, it } from "vitest";
import { normalizeApifyTikTokItem } from "../src/lib/sources/apify-tiktok";

describe("normalizeApifyTikTokItem", () => {
  it("normalizes common TikTok actor fields", () => {
    const post = normalizeApifyTikTokItem({
      id: "7350000000000000000",
      webVideoUrl: "https://www.tiktok.com/@stockrobber/video/7350000000000000000",
      text: "Example caption",
      createTime: "1710000000",
      videoMeta: {
        duration: 121,
        coverUrl: "https://example.com/cover.jpg",
        downloadAddr: "https://example.com/video.mp4",
      },
    });

    expect(post?.platformPostId).toBe("7350000000000000000");
    expect(post?.durationSeconds).toBe(121);
    expect(post?.mediaUrl).toContain("video.mp4");
  });

  it("ignores items without a URL", () => {
    expect(normalizeApifyTikTokItem({ id: "1" })).toBeNull();
  });
});
