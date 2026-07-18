"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  pendingLabel: string;
  tone?: "dark" | "accent" | "border";
  className?: string;
};

export function SubmitButton({ label, pendingLabel, tone = "dark", className = "" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const toneClass =
    tone === "accent"
      ? "bg-[var(--accent)] text-white"
      : tone === "border"
        ? "border border-[var(--line)] bg-white text-[var(--foreground)]"
        : "bg-[var(--foreground)] text-white";

  return (
    <button
      aria-live="polite"
      className={`inline-flex w-fit items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition ${toneClass} ${className}`}
      disabled={pending}
      type="submit"
    >
      {pending ? <Loader2 className="animate-spin" size={16} /> : null}
      {pending ? pendingLabel : label}
    </button>
  );
}
