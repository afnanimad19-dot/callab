"use client";

// Bottom-left workspace switcher. Each workspace is a fully isolated dataset
// (its own agents, calls, contacts, calendar…). Switching re-scopes the whole
// dashboard; "Add new workspace" spins up a fresh, zero-state one (gated by the
// account's plan).

import { useEffect, useRef, useState } from "react";
import { Building2, ChevronsUpDown, Plus, Check, Lock } from "lucide-react";
import Link from "next/link";
import { toast, toastError } from "@/components/Toast";

type WS = { id: string; name: string; isDefault: boolean };

export default function WorkspaceSwitcher({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<WS[]>([]);
  const [active, setActive] = useState<string>("");
  const [canAdd, setCanAdd] = useState(true);
  const [planName, setPlanName] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/workspaces");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setList(data.workspaces ?? []);
      setActive(data.active ?? "");
      setCanAdd(Boolean(data.canAdd));
      setPlanName(data.planName ?? "");
    }
  }
  useEffect(() => { if (open && !list.length) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAdding(false); } }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function switchTo(id: string) {
    if (id === active || busy) return;
    setBusy(true);
    const res = await fetch("/api/workspaces", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch", workspaceId: id }),
    });
    if (res.ok) window.location.assign("/dashboard");
    else { setBusy(false); toastError("Could not switch workspace."); }
  }

  async function create() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    const res = await fetch("/api/workspaces", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { toast("Workspace created."); window.location.assign("/dashboard"); }
    else { setBusy(false); toastError(data.error ?? "Could not create the workspace."); }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink-700 px-3 py-2 transition hover:border-ink-500"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-ink-400" />
          <span className="truncate text-sm font-medium">{current}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-400" />
      </button>

      {open && (
        <div className="absolute bottom-11 left-0 z-40 w-full min-w-[220px] overflow-hidden rounded-xl border border-ink-700 bg-white shadow-xl">
          <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Workspaces</p>
          <div className="max-h-56 overflow-y-auto">
            {list.map((w) => (
              <button key={w.id} onClick={() => switchTo(w.id)} disabled={busy}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink-800 transition hover:bg-ink-100 disabled:opacity-60">
                <span className="truncate">{w.name}{w.isDefault && <span className="ml-1 text-[10px] text-ink-400">(default)</span>}</span>
                {w.id === active && <Check className="h-4 w-4 shrink-0 text-[#301C3F]" />}
              </button>
            ))}
            {list.length === 0 && <p className="px-3 py-2 text-sm text-ink-400">Loading…</p>}
          </div>

          <div className="border-t border-ink-100">
            {adding ? (
              <div className="p-2">
                <input
                  autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && create()}
                  placeholder="Workspace name" className="field !py-1.5 !text-sm"
                />
                <div className="mt-2 flex gap-2">
                  <button onClick={create} disabled={busy || !newName.trim()} className="btn-primary flex-1 !py-1.5 !text-xs disabled:opacity-50">Create &amp; switch</button>
                  <button onClick={() => setAdding(false)} className="btn-secondary !py-1.5 !text-xs">Cancel</button>
                </div>
              </div>
            ) : canAdd ? (
              <button onClick={() => setAdding(true)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-[#301C3F] transition hover:bg-ink-100">
                <Plus className="h-4 w-4" /> Add new workspace
              </button>
            ) : (
              <Link href="/dashboard/plans" onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ink-500 transition hover:bg-ink-100">
                <Lock className="h-3.5 w-3.5" /> {planName} plan limit reached — upgrade
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
