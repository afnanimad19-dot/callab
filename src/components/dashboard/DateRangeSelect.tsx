"use client";

// "Last 7 Days ▾" dropdown on the Home Dashboard — sets ?range= and the
// server recomputes every chart for that window.

import { useState } from "react";
import { useRouter } from "next/navigation";

export const RANGES: { key: string; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
];

export default function DateRangeSelect({ current }: { current: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const label = RANGES.find((r) => r.key === current)?.label ?? "Last 7 Days";

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="btn-secondary !py-2">
        {label} <span className="text-ink-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 py-1 shadow-xl shadow-black/30">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => {
                setOpen(false);
                router.push(`/dashboard?range=${r.key}`);
              }}
              className={`flex w-full items-center justify-between px-4 py-2 text-sm transition hover:bg-ink-800 ${
                r.key === current ? "font-semibold text-accent-300" : "text-ink-200"
              }`}
            >
              {r.label}
              {r.key === current && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
