export function ReliabilityDots({ score, max = 5, label, compact = false }: { score: number; max?: number; label?: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, index) => (
          <span
            aria-hidden="true"
            className={`${compact ? "h-2 w-2" : "h-2.5 w-2.5"} rounded-full ${index < score ? "bg-[var(--accent)]" : "bg-slate-200"}`}
            key={index}
          />
        ))}
      </div>
      {label ? <span className={`${compact ? "text-xs" : "text-sm"} font-semibold text-slate-600`}>{label}</span> : null}
      <span className="sr-only">{score} av {max} reliability</span>
    </div>
  );
}
