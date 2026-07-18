import type { ProcessingStatus, Signal } from "@/lib/types";

const statusLabels: Record<ProcessingStatus, string> = {
  new: "Ny",
  processing: "Behandlas",
  transcribed: "Transkriberad",
  analyzed: "Klar",
  failed: "Misslyckad",
};

export function StatusBadge({ status }: { status: ProcessingStatus }) {
  const tone =
    status === "analyzed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "failed"
        ? "border-red-200 bg-red-50 text-red-800"
        : status === "processing"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return <span className={`inline-flex items-center rounded border px-2 py-1 text-xs font-medium ${tone}`}>{statusLabels[status]}</span>;
}

export function SignalBadge({ signal }: { signal?: Signal }) {
  if (!signal) return <span className="text-sm text-slate-500">Ingen signal</span>;

  const tone =
    signal.action === "BUY_CANDIDATE"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : signal.action === "AVOID" || signal.action === "REDUCE"
        ? "border-red-300 bg-red-50 text-red-900"
        : signal.action === "INSUFFICIENT_DATA"
          ? "border-slate-300 bg-slate-50 text-slate-700"
          : "border-cyan-300 bg-cyan-50 text-cyan-900";

  return <span className={`inline-flex items-center rounded border px-2 py-1 text-xs font-semibold ${tone}`}>{signal.action}</span>;
}

export function RiskBadge({ risk }: { risk?: string }) {
  if (!risk) return null;
  const tone =
    risk === "high"
      ? "text-red-700"
      : risk === "medium"
        ? "text-amber-700"
        : risk === "low"
          ? "text-emerald-700"
          : "text-slate-600";
  return <span className={`text-sm font-medium ${tone}`}>Risk: {risk}</span>;
}
