"use client";

import { Loader2, SearchCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

const STEPS = [
  "Startar Apify-körning",
  "Letar senaste TikTok-klipp",
  "Sorterar bort irrelevant innehåll",
  "Matchar mot ignore-listan",
  "Kollar dubletter i databasen",
  "Hämtar transkript för nya klipp",
  "Läser mellan raderna",
  "Plockar ut aktier och triggers",
  "Räknar tidshorisont och risk",
  "Sparar beslut i dashboarden",
];

export function ScrapeProgressOverlay() {
  const { pending } = useFormStatus();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!pending) {
      setStepIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
    }, 1300);

    return () => window.clearInterval(timer);
  }, [pending]);

  if (!pending) return null;

  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <section aria-labelledby="scrape-progress-title" aria-modal="true" className="w-full max-w-md rounded-xl border border-emerald-100 bg-white p-5 shadow-2xl" role="dialog">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
            <SearchCheck size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black" id="scrape-progress-title">Scrape körs</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Stanna kvar här. Resultatet dyker upp automatiskt när körningen är klar.</p>
          </div>
        </div>

        <div className="mt-5 rounded-lg bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-[var(--accent)]" size={18} />
            <div className="min-w-0">
              <div className="text-sm font-bold">{STEPS[stepIndex]}</div>
              <div className="mt-1 text-xs text-slate-500">Steg {stepIndex + 1} av {STEPS.length}</div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-500">
          {STEPS.slice(Math.max(0, stepIndex - 1), Math.min(STEPS.length, stepIndex + 3)).map((step, index) => {
            const absoluteIndex = Math.max(0, stepIndex - 1) + index;
            return (
              <div key={step} className={`flex items-center gap-2 ${absoluteIndex === stepIndex ? "text-[var(--foreground)]" : ""}`}>
                <span className={`h-2 w-2 rounded-full ${absoluteIndex <= stepIndex ? "bg-[var(--accent)]" : "bg-slate-300"}`} />
                <span>{step}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
