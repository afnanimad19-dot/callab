"use client";

// Tiny global toast notifications. Call toast("Saved.") from anywhere in the
// dashboard; ToastHost (mounted once in the dashboard layout) renders them
// bottom-right, stacked when several fire, each with its own dismiss button.

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

const EVENT = "vl-toast";

export function toast(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
  }
}

interface Item {
  id: number;
  message: string;
}

export default function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const message = String((e as CustomEvent).detail ?? "");
      if (!message) return;
      const id = Date.now() + Math.random();
      setItems((list) => [...list, { id, message }].slice(-5));
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4000);
    }
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-950 py-2 pl-3 pr-2 text-sm shadow-lg shadow-black/10"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="max-w-[260px]">{t.message}</span>
          <button
            onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
            aria-label="Dismiss"
            className="rounded p-1 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
