import { FileText, Search, SlidersHorizontal } from "lucide-react";
import { addManualTranscriptAction, scrapePostsAction } from "@/app/actions";
import { ExplainLevelSelect } from "@/components/explain-level-select";
import { ScrapeProgressOverlay } from "@/components/scrape-progress-overlay";
import { SubmitButton } from "@/components/submit-button";

export function FilterForm({ params }: { params: Record<string, string> }) {
  return (
    <form className="grid gap-3 rounded border border-[var(--line)] bg-[var(--panel)] p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]" action="/">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Sök
        <div className="flex items-center gap-2 rounded border border-[var(--line)] px-3 py-2">
          <Search size={16} />
          <input className="w-full bg-transparent outline-none" name="search" defaultValue={params.search || ""} placeholder="Bolag, ticker eller text" />
        </div>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Status
        <select className="rounded border border-[var(--line)] bg-white px-3 py-2" name="status" defaultValue={params.status || "all"}>
          <option value="all">Alla</option>
          <option value="new">Ny</option>
          <option value="processing">Behandlas</option>
          <option value="transcribed">Transkriberad</option>
          <option value="analyzed">Klar</option>
          <option value="failed">Misslyckad</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Signal
        <select className="rounded border border-[var(--line)] bg-white px-3 py-2" name="signal" defaultValue={params.signal || "all"}>
          <option value="all">Alla</option>
          <option value="BUY_CANDIDATE">BUY_CANDIDATE</option>
          <option value="WATCH">WATCH</option>
          <option value="HOLD">HOLD</option>
          <option value="REDUCE">REDUCE</option>
          <option value="AVOID">AVOID</option>
          <option value="INSUFFICIENT_DATA">INSUFFICIENT_DATA</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Risk
        <select className="rounded border border-[var(--line)] bg-white px-3 py-2" name="risk" defaultValue={params.risk || "all"}>
          <option value="all">Alla</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
          <option value="unknown">unknown</option>
        </select>
      </label>
      <button className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded bg-[var(--foreground)] px-4 text-sm font-semibold text-white" type="submit">
        <SlidersHorizontal size={16} /> Filtrera
      </button>
    </form>
  );
}

export function ManualTranscriptForm() {
  return (
    <form action={addManualTranscriptAction} className="grid gap-4 rounded border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="flex items-center gap-2">
        <FileText size={18} />
        <h2 className="text-base font-semibold">Lägg till transkriberad video manuellt</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          TikTok-länk eller valfri referens
          <input className="rounded border border-[var(--line)] px-3 py-2" name="url" placeholder="https://www.tiktok.com/@stockrobber/video/..." />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Publiceringsdatum
          <input className="rounded border border-[var(--line)] px-3 py-2" name="publishedAt" type="datetime-local" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Kort beskrivning
        <input className="rounded border border-[var(--line)] px-3 py-2" name="caption" placeholder="Valfritt" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Transkription
        <textarea className="min-h-44 resize-y rounded border border-[var(--line)] px-3 py-2 leading-6" name="transcript" required placeholder="Klistra in videons transkriberade text här" />
      </label>
      <ExplainLevelSelect />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input name="analyzeNow" value="yes" type="checkbox" />
        Analysera direkt med OpenAI
      </label>
      <SubmitButton label="Spara testvideo" pendingLabel="Sparar och analyserar..." tone="accent" />
    </form>
  );
}

export function ManualScrapeForm() {
  return (
    <form action={scrapePostsAction} className="grid gap-4 rounded border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="flex items-center gap-2">
        <Search size={18} />
        <h2 className="text-base font-semibold">Manuell scrape/backfill</h2>
      </div>
      <p className="text-sm leading-6 text-slate-600">Hämtar senaste TikTok-posterna via Apify. Nya videos skickas till transcript-actorn och analyseras direkt.</p>
      <label className="flex max-w-xs flex-col gap-1 text-sm font-medium">
        Antal videos att kontrollera
        <input className="rounded border border-[var(--line)] px-3 py-2" name="limit" type="number" min="1" max="50" defaultValue="5" />
      </label>
      <ScrapeProgressOverlay />
      <SubmitButton label="Starta scrape" pendingLabel="Scrape körs..." />
    </form>
  );
}
