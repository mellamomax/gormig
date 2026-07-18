export function inferHorizonDays(label: string | null | undefined) {
  if (!label) return 30;
  const text = label.toLowerCase();
  const numberMatch = text.match(/(\d+(?:[,.]\d+)?)/);
  const amount = numberMatch ? Number(numberMatch[1].replace(",", ".")) : 1;

  if (text.includes("dag")) return Math.max(1, Math.round(amount));
  if (text.includes("vecka") || text.includes("veckor")) return Math.max(7, Math.round(amount * 7));
  if (text.includes("månad") || text.includes("manad") || text.includes("mån")) return Math.max(14, Math.round(amount * 30));
  if (text.includes("kvartal")) return Math.max(30, Math.round(amount * 90));
  if (text.includes("år") || text.includes("ar")) return Math.max(90, Math.round(amount * 365));
  if (text.includes("kort")) return 30;
  if (text.includes("lång")) return 180;

  return 30;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
