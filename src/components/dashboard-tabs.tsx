import Link from "next/link";
import { BarChart3, ClipboardList, Gauge, PlaySquare, Search, WalletCards } from "lucide-react";

const tabs = [
  { id: "overview", label: "Beslut", icon: Gauge },
  { id: "videos", label: "Analyser", icon: ClipboardList },
  { id: "manual", label: "Manuellt", icon: PlaySquare },
  { id: "scrape", label: "Scrape", icon: Search },
  { id: "outcomes", label: "Utfall", icon: BarChart3 },
  { id: "paper", label: "Paper", icon: WalletCards },
];

export function DashboardTabs({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-sm">
      {tabs.map((tab) => {
        const selected = active === tab.id;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold ${selected ? "bg-[var(--foreground)] !text-white shadow-sm" : "text-slate-600 hover:bg-[var(--panel-2)]"}`}
            href={tab.id === "overview" ? "/" : `/?tab=${tab.id}`}
            aria-current={selected ? "page" : undefined}
          >
            <Icon size={16} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
