"use client";

// Shared three-dots row menu. Closes on ANY outside click (document-level
// listener) or Escape — every table/card menu should use this so the
// behavior is consistent across the app.

import { useEffect, useRef, useState } from "react";
import { MoreVertical, type LucideIcon } from "lucide-react";

export interface RowMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

export default function RowMenu({
  items,
  align = "right",
}: {
  items: RowMenuItem[];
  align?: "right" | "left";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions"
        className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          className={`absolute top-9 z-30 w-44 overflow-hidden rounded-xl border border-ink-700 bg-ink-950 py-1 text-left shadow-xl shadow-black/20 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm transition hover:bg-ink-800 ${
                item.danger ? "text-signal-red" : "text-ink-200"
              }`}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" /> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
