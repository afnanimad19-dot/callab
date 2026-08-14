"use client";

// Shared three-dots row menu. The dropdown is rendered in a PORTAL with fixed
// positioning so it never gets clipped by a parent's `overflow` (tables use
// overflow-x-auto, which would otherwise crop the menu and add a stray
// scrollbar). Closes on outside click, Escape, scroll or resize.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const MENU_W = 176;

  function place() {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuHeight = items.length * 38 + 8;
    const dropUp = window.innerHeight - rect.bottom < menuHeight + 12;
    const top = dropUp ? rect.top - menuHeight - 4 : rect.bottom + 4;
    const left = align === "right" ? rect.right - MENU_W : rect.left;
    setPos({ top, left: Math.max(8, left) });
  }

  function toggle() {
    if (!open) place();
    setOpen((v) => !v);
  }

  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    function onScrollResize() { setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open]);

  return (
    <div className="inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Actions"
        aria-expanded={open}
        className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_W }}
            className="z-[100] overflow-hidden rounded-xl border border-ink-700 bg-ink-950 py-1 text-left shadow-xl shadow-black/20"
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => { setOpen(false); item.onClick(); }}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm transition hover:bg-ink-800 ${
                  item.danger ? "text-signal-red" : "text-ink-200"
                }`}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" /> {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
