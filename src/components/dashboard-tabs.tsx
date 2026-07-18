import Link from "next/link";

const tabs = [
  { id: "overview", label: "Överblick" },
  { id: "videos", label: "Videos" },
  { id: "manual", label: "Testa manuellt" },
  { id: "scrape", label: "Scrape" },
  { id: "outcomes", label: "Uppföljning" },
];

export function DashboardTabs({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-2 rounded border border-[var(--line)] bg-[var(--panel)] p-2">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          className={`rounded px-3 py-2 text-sm font-semibold ${active === tab.id ? "bg-[var(--foreground)] text-white" : "text-slate-600 hover:bg-[var(--panel-2)]"}`}
          href={tab.id === "overview" ? "/" : `/?tab=${tab.id}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
