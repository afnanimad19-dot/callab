"use client";

// Tiny global toast notifications. Call toast("Saved.") from anywhere in the
// dashboard; ToastHost (mounted once in the dashboard layout) renders them
// bottom-right, stacked when several fire, each with its own dismiss button.

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

const EVENT = "vl-toast";

export function toast(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind: "success" } }));
  }
}

// Red variant for failures — same size and stacking, different icon/border.
export function toastError(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind: "error" } }));
  }
}

interface Item {
  id: number;
  message: string;
  kind: "success" | "error";
}

export default function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent).detail;
      const message = typeof detail === "string" ? detail : String(detail?.message ?? "");
      const kind: Item["kind"] = detail?.kind === "error" ? "error" : "success";
      if (!message) return;
      const id = Date.now() + Math.random();
      setItems((list) => [...list, { id, message, kind }].slice(-5));
      // Errors stay a bit longer so they can actually be read.
      setTimeout(
        () => setItems((list) => list.filter((t) => t.id !== id)),
        kind === "error" ? 6000 : 4000
      );
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
          className={`pointer-events-auto flex items-center gap-2.5 rounded-lg border py-2 pl-3 pr-2 text-sm shadow-lg shadow-black/10 ${
            t.kind === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-ink-700 bg-ink-950"
          }`}
        >
          {t.kind === "error" ? (
            <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          )}
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
