"use client";

import { useState } from "react";
import { DEFAULT_EXPLAIN_LEVEL, EXPLAIN_LEVELS, getExplainLevelLabel, type ExplainLevel } from "@/lib/explain-level";
import type { SummaryMap } from "@/lib/summary";

export function SummaryLevelSwitcher({ summaries, headline }: { summaries: SummaryMap; headline?: string }) {
  const [level, setLevel] = useState<ExplainLevel>(DEFAULT_EXPLAIN_LEVEL);

  return (
    <section className="rounded border border-[var(--line)] bg-[var(--panel-2)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {headline ? <p className="text-sm font-semibold text-[var(--accent)]">{headline}</p> : null}
          <p className="mt-1 text-sm leading-6 text-slate-700">{summaries[level]}</p>
        </div>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Förklara som
          <select
            className="h-9 rounded border border-[var(--line)] bg-white px-2 text-sm"
            value={level}
            onChange={(event) => setLevel(event.target.value as ExplainLevel)}
          >
            {EXPLAIN_LEVELS.map((item) => (
              <option key={item} value={item}>{getExplainLevelLabel(item)}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
