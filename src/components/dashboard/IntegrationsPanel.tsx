"use client";
import { Search, RefreshCw, Trash2, Tag, FolderOpen, Zap, Clock, Play, Pause } from "lucide-react";
import { toast } from "@/components/Toast";

// Integrations: platform connections (env-based status) + custom
// integration workflows (name, tags, N-step workflow, interval,
// Start/Execute) with a create modal.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { Integration, WebhookStep } from "@/lib/db";

const STATUS_BADGE: Record<Integration["status"], string> = {
  idle: "badge-muted",
  running: "badge-ok",
  failed: "badge-bad",
  success: "badge-ok",
};

interface Platform {
  name: string;
  detail: string;
  connected: boolean;
  hint: string;
}

export default function IntegrationsPanel({
  integrations,
  platforms,
}: {
  integrations: Integration[];
  platforms: Platform[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return integrations.filter(
      (i) => !q || `${i.name} ${i.tag} ${i.category}`.toLowerCase().includes(q)
    );
  }, [integrations, query]);

  async function setStatus(id: string, body: Record<string, unknown>) {
    await fetch(`/api/integrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    toast(body.run ? "Integration executed." : body.status === "running" ? "Integration started." : "Integration stopped.");
    router.refresh();
  }

  async function remove(i: Integration) {
    if (!confirm(`Delete integration "${i.name}"?`)) return;
    await fetch(`/api/integrations/${i.id}`, { method: "DELETE" });
    toast(`Integration "${i.name}" deleted.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="mt-1 text-sm text-ink-400">Connect your favorite tools and services</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">+ Add Integration</button>
      </div>

      <div className="card flex items-center gap-3 !p-4">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"><Search className="h-4 w-4" /></span>
          <input className="field !pl-10" placeholder="Search by name, tag, or category..."
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button onClick={() => router.refresh()} aria-label="Refresh" className="btn-secondary !px-3.5 !py-2.5"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* Custom integration workflows */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((i) => (
          <div key={i.id} className="card card-hover !p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="grad-bg flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white">
                  {i.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{i.name}</h2>
                  <span className={STATUS_BADGE[i.status]}>
                    ● {i.status === "idle" ? "Not started" : i.status}
                  </span>
                </div>
              </div>
              <button onClick={() => remove(i)} aria-label="Delete"
                className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              {i.tag && <span className="badge-muted inline-flex items-center gap-1"><Tag className="h-3 w-3" /> {i.tag}</span>}
              {i.category && <span className="badge-muted inline-flex items-center gap-1"><FolderOpen className="h-3 w-3" /> {i.category}</span>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-ink-700 p-3 text-center">
              <div>
                <p className="flex items-center justify-center gap-1 text-sm font-bold"><Zap className="h-3.5 w-3.5 text-ink-400" /> {i.steps.length} step{i.steps.length === 1 ? "" : "s"}</p>
                <p className="text-xs text-ink-400">workflow</p>
              </div>
              <div>
                <p className="flex items-center justify-center gap-1 text-sm font-bold"><Clock className="h-3.5 w-3.5 text-ink-400" /> {i.intervalSeconds}s</p>
                <p className="text-xs text-ink-400">interval</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {i.status === "running" ? (
                <button onClick={() => setStatus(i.id, { status: "idle" })}
                  className="btn-secondary flex items-center justify-center gap-1.5 !py-2 !text-xs !text-signal-amber"><Pause className="h-3 w-3" /> Stop</button>
              ) : (
                <button onClick={() => setStatus(i.id, { status: "running" })}
                  className="btn-secondary flex items-center justify-center gap-1.5 !py-2 !text-xs !text-accent-300"><Play className="h-3 w-3" /> Start</button>
              )}
              <button onClick={() => setStatus(i.id, { run: true })}
                className="btn-secondary flex items-center justify-center gap-1.5 !py-2 !text-xs"><Zap className="h-3 w-3" /> Execute</button>
            </div>
            {i.lastRunAt && (
              <p className="mt-2 text-xs text-ink-500">Last run {new Date(i.lastRunAt).toLocaleString()}</p>
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-ink-500">
        {visible.length === 0
          ? "No custom integrations yet — add one to automate contact syncs and data flows."
          : `Showing all ${visible.length} integration${visible.length === 1 ? "" : "s"}`}
      </p>

      {/* Platform connections */}
      <div>
        <h2 className="text-base font-semibold">Platform connections</h2>
        <p className="text-sm text-ink-400">Read from your environment variables — keys are never stored in the database.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {platforms.map((p) => (
            <div key={p.name} className="card card-hover">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold">{p.name}</h3>
                <span className={p.connected ? "badge-ok" : "badge-muted"}>
                  {p.connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-300">{p.detail}</p>
              {!p.connected && (
                <p className="mt-3 rounded-lg bg-ink-800 px-3 py-2 font-mono text-xs text-ink-300">{p.hint}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {createOpen && (
        <CreateIntegrationModal onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); toast("Integration created."); router.refresh(); }} />
      )}
    </div>
  );
}

function CreateIntegrationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [category, setCategory] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState(20);
  const [steps, setSteps] = useState<WebhookStep[]>([{ name: "", method: "POST", url: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tag, category, intervalSeconds, steps }),
    });
    if (res.ok) onCreated();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Integration"
      subtitle="Build a workflow that syncs data with your external systems." wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input className="field" placeholder="Bring contacts" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Run interval (seconds)</label>
            <input type="number" min={10} className="field" value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Tag</label>
            <input className="field" placeholder="crm_sync" value={tag} onChange={(e) => setTag(e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <input className="field" placeholder="contacts" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label !mb-0">Workflow steps</label>
            <button onClick={() => setSteps([...steps, { name: "", method: "POST", url: "" }])}
              className="btn-secondary !px-3 !py-1.5 !text-xs">+ Add Step</button>
          </div>
          <div className="mt-2 space-y-2.5">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input className="field w-36" placeholder="Step name" value={s.name}
                  onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <select className="field w-24" value={s.method}
                  onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, method: e.target.value as WebhookStep["method"] } : x)))}>
                  {["POST", "GET", "PUT"].map((m) => <option key={m}>{m}</option>)}
                </select>
                <input className="field flex-1" placeholder="https://api.example.com/…" value={s.url}
                  onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                {steps.length > 1 && (
                  <button onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                    aria-label="Remove step" className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
        {error && (
          <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={create} disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? "Creating…" : "Create Integration"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
