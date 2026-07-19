export function extractTikTokVideoId(url: string | null | undefined) {
  if (!url) return null;

  const trimmed = url.trim();
  const videoMatch = trimmed.match(/\/video\/(\d+)/);
  if (videoMatch?.[1]) return videoMatch[1];

  const numericOnly = trimmed.match(/^\d{10,}$/);
  if (numericOnly) return trimmed;

  return null;
}
