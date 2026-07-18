export function inferHorizonDays(label: string | null | undefined) {
  if (!label) return null;
  const text = label.toLowerCase();
  if (text.includes("oklar") || text.includes("saknas") || text.includes("inte angiven") || text.includes("unknown")) return null;

  const rangeMatch = text.match(/(\d+(?:[,.]\d+)?)\s*(?:-|–|—|till)\s*(\d+(?:[,.]\d+)?)/);
  const numberMatch = rangeMatch?.[2] || text.match(/(\d+(?:[,.]\d+)?)/)?.[1];
  const amount = numberMatch ? Number(numberMatch.replace(",", ".")) : 1;

  if (text.includes("timme") || text.includes("timmar") || text.includes("hour")) return 1;
  if (text.includes("idag") || text.includes("i dag") || text.includes("intraday")) return 1;
  if (text.includes("imorgon") || text.includes("i morgon")) return 1;
  if (text.includes("dag")) return Math.max(1, Math.round(amount));
  if (text.includes("vecka") || text.includes("veckor")) return Math.max(7, Math.round(amount * 7));
  if (text.includes("månad") || text.includes("manad") || text.includes("mån")) return Math.max(14, Math.round(amount * 30));
  if (text.includes("kvartal")) return Math.max(30, Math.round(amount * 90));
  if (text.includes("år") || text.includes("ar")) return Math.max(90, Math.round(amount * 365));
  if (text.includes("rapport") || text.includes("earnings")) return 14;
  if (text.includes("snart") || text.includes("närtid") || text.includes("kortsiktig") || text.includes("kort sikt")) return 14;
  if (text.includes("långsiktig") || text.includes("lång sikt")) return 365;

  return null;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
