import { DEFAULT_EXPLAIN_LEVEL, EXPLAIN_LEVELS, getExplainLevelLabel, type ExplainLevel } from "@/lib/explain-level";

export function ExplainLevelSelect({ defaultValue = DEFAULT_EXPLAIN_LEVEL, compact = false }: { defaultValue?: ExplainLevel; compact?: boolean }) {
  return (
    <label className={compact ? "grid gap-1 text-xs font-medium text-slate-600" : "flex flex-col gap-1 text-sm font-medium"}>
      Förklara som
      <select
        className={compact ? "h-9 rounded border border-[var(--line)] bg-white px-2 text-sm" : "rounded border border-[var(--line)] bg-white px-3 py-2"}
        name="explainLevel"
        defaultValue={defaultValue}
      >
        {EXPLAIN_LEVELS.map((level) => (
          <option key={level} value={level}>{getExplainLevelLabel(level)}</option>
        ))}
      </select>
    </label>
  );
}
