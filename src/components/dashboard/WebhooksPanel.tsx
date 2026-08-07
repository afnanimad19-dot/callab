"use client";
import { Search, RefreshCw, MoreVertical } from "lucide-react";

// Webhooks: searchable list, "Choose Webhook Template" modal (Start from
// Scratch + template gallery), and a two-step "Create Custom Webhook"
// builder (Details → Steps & custom variables) with a payload preview.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { Webhook, WebhookStep, WebhookVariable } from "@/lib/db";

const EVENTS = ["call.started", "call.ended", "call.escalated", "campaign.completed"];

export default function WebhooksPanel({ webhooks }: { webhooks: Webhook[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [chooser, setChooser] = useState(false);
  const [builder, setBuilder] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return webhooks.filter(
      (w) => !q || `${w.name ?? ""} ${w.url} ${w.events.join(" ")}`.toLowerCase().includes(q)
    );
  }, [webhooks, query]);

  async function remove(w: Webhook) {
    setMenuFor(null);
    if (!confirm(`Delete webhook "${w.name ?? w.url}"?`)) return;
    await fetch(`/api/webhooks/${w.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5" onClick={() => setMenuFor(null)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
          <p className="mt-1 text-sm text-ink-400">
            Configure webhooks to send data to external services
          </p>
        </div>
        <button onClick={() => setChooser(true)} className="btn-primary">+ Add Webhook</button>
      </div>

      <div className="card flex items-center gap-3 !p-4">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"><Search className="h-4 w-4" /></span>
          <input className="field !pl-10" placeholder="Search by name, tag, or category..."
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button onClick={() => router.refresh()} aria-label="Refresh" className="btn-secondary !px-3.5 !py-2.5"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {visible.length === 0 ? (
        <div className="card flex flex-col items-center border-dashed py-14 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/empty-state.webp" alt="" className="h-28 w-28" />
          <p className="mt-4 text-sm font-semibold">No webhooks found</p>
          <p className="mt-1 text-sm text-ink-400">Get started by adding your first webhook</p>
          <button onClick={() => setChooser(true)} className="btn-primary mt-5">+ Add Webhook</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((w) => (
            <div key={w.id} className="card card-hover relative !p-5">
              <div className="flex items-start justify-between">
                <h2 className="text-sm font-semibold">{w.name ?? "Webhook"}</h2>
                <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === w.id ? null : w.id); }}
                  aria-label="Actions"
                  className="rounded-lg px-2 py-0.5 text-lg leading-none text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"><MoreVertical className="h-4 w-4" /></button>
                {menuFor === w.id && (
                  <div className="absolute right-4 top-11 z-20 w-36 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 py-1 shadow-xl shadow-black/30"
                    onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => remove(w)} className="block w-full px-4 py-2 text-left text-sm text-signal-red transition hover:bg-ink-800">
                      🗑 Delete
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-1.5 break-all font-mono text-xs text-ink-300">{w.url}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {w.events.map((e) => <span key={e} className="badge-muted">{e}</span>)}
                {(w.steps?.length ?? 0) > 0 && (
                  <span className="badge-warn">⚡ {w.steps!.length} step{w.steps!.length === 1 ? "" : "s"}</span>
                )}
                <span className={w.active ? "badge-ok" : "badge-muted"}>{w.active ? "active" : "disabled"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template chooser */}
      <Modal open={chooser} onClose={() => setChooser(false)} title="Choose Webhook Template"
        subtitle="Start from scratch or use a pre-built template to create your webhook" wide>
        <button
          onClick={() => { setChooser(false); setBuilder(true); }}
          className="card card-hover flex w-full items-center justify-between !p-5 text-left">
          <span className="flex items-center gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-ink-500 text-lg">+</span>
            <span>
              <span className="block text-sm font-semibold">Start from Scratch</span>
              <span className="block text-sm text-ink-400">Create a custom webhook with your own configuration</span>
            </span>
          </span>
          <span className="text-ink-400">→</span>
        </button>
        <div className="mt-4 rounded-xl border border-dashed border-ink-600 py-12 text-center text-sm text-ink-400">
          <p className="text-2xl">🔍</p>
          <p className="mt-3">No templates available</p>
          <p className="mt-1 text-xs">Check back later for new templates</p>
        </div>
      </Modal>

      {builder && (
        <WebhookBuilder onClose={() => setBuilder(false)}
          onSaved={() => { setBuilder(false); router.refresh(); }} />
      )}
    </div>
  );
}

function WebhookBuilder({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["call.ended"]);
  const [steps, setSteps] = useState<WebhookStep[]>([]);
  const [variables, setVariables] = useState<WebhookVariable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, events, steps, variables }),
    });
    if (res.ok) onSaved();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
    }
  }

  const samplePayload = {
    event: events[0] ?? "call.ended",
    call: { id: "call_123", from: "+14155550142", durationSec: 187, outcome: "resolved" },
    variables: Object.fromEntries(variables.map((v) => [v.name, v.value || `<${v.jsonPath || v.sourceType}>`])),
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-3xl flex-col border-l border-ink-700 bg-ink-900">
        <div className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
          <h2 className="text-lg font-bold">Create Custom Webhook</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100">✕</button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 border-b border-ink-700 px-6 py-4">
          {["Details", "Steps"].map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  i < step ? "grad-bg text-white" : i === step ? "border-2 border-accent-500 bg-ink-800 text-accent-300" : "bg-ink-800 text-ink-400"
                }`}>{i < step ? "✓" : i + 1}</span>
                <span className={`text-[11px] ${i === step ? "font-semibold" : "text-ink-400"}`}>{s}</span>
              </div>
              {i === 0 && <div className="mb-4 h-px flex-1 bg-ink-700" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="label">Webhook Name</label>
                <input className="field" placeholder="CRM sync" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Endpoint URL</label>
                <input className="field" placeholder="https://example.com/webhooks/calls" value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
              <div>
                <label className="label">Trigger events</label>
                <div className="flex flex-wrap gap-2">
                  {EVENTS.map((e) => (
                    <button key={e}
                      onClick={() => setEvents(events.includes(e) ? events.filter((x) => x !== e) : [...events, e])}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                        events.includes(e) ? "grad-bg text-white" : "bg-ink-800 text-ink-300 hover:text-ink-100"
                      }`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              {/* Steps */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Webhook Steps</h3>
                    <p className="text-sm text-ink-400">Configure the flow of your webhook integration</p>
                  </div>
                  <button onClick={() => setSteps([...steps, { name: "", method: "POST", url: "" }])}
                    className="btn-primary !px-4 !py-2 !text-xs">+ Add Step</button>
                </div>
                {steps.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-ink-600 py-10 text-center text-sm text-ink-400">
                    No steps added yet
                    <p className="mt-1 text-xs">Click Add Step to define the webhook flow</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {steps.map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="flex h-10 w-8 items-center justify-center text-xs font-bold text-ink-400">{i + 1}</span>
                        <input className="field w-40" placeholder="Step name" value={s.name}
                          onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                        <select className="field w-24" value={s.method}
                          onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, method: e.target.value as WebhookStep["method"] } : x)))}>
                          {["POST", "GET", "PUT"].map((m) => <option key={m}>{m}</option>)}
                        </select>
                        <input className="field flex-1" placeholder="https://api.example.com/…" value={s.url}
                          onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                        <button onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                          className="text-ink-400 hover:text-signal-red">🗑</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Variables */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Custom Variables</h3>
                    <p className="text-sm text-ink-400">Define variables that can be used within your webhook steps</p>
                  </div>
                  <button
                    onClick={() => setVariables([...variables, { name: "", jsonPath: "", sourceType: "response", dataType: "string", value: "" }])}
                    className="btn-primary !px-4 !py-2 !text-xs">+ Add Variable</button>
                </div>
                <div className="mt-3 rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 text-xs text-ink-300">
                  ⓘ Define variables to pass data between steps — e.g. use the output of one API call as input to
                  another. Reference them by name (e.g. <code className="text-accent-300">user_id</code>).
                </div>
                {variables.map((v, i) => (
                  <div key={i} className="mt-3 grid gap-3 rounded-xl border border-ink-700 p-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Variable Name</label>
                      <input className="field" placeholder="e.g., user_id" value={v.name}
                        onChange={(e) => setVariables(variables.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    </div>
                    <div>
                      <label className="label">JSON Path Location</label>
                      <input className="field" placeholder="e.g., data.user.id" value={v.jsonPath}
                        onChange={(e) => setVariables(variables.map((x, j) => (j === i ? { ...x, jsonPath: e.target.value } : x)))} />
                    </div>
                    <div>
                      <label className="label">Source Type</label>
                      <select className="field" value={v.sourceType}
                        onChange={(e) => setVariables(variables.map((x, j) => (j === i ? { ...x, sourceType: e.target.value as WebhookVariable["sourceType"] } : x)))}>
                        <option value="response">Response</option>
                        <option value="static">Static value</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Data Type</label>
                      <select className="field" value={v.dataType}
                        onChange={(e) => setVariables(variables.map((x, j) => (j === i ? { ...x, dataType: e.target.value as WebhookVariable["dataType"] } : x)))}>
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Custom Value (Optional)</label>
                      <div className="flex gap-2">
                        <input className="field" placeholder="Enter static value if needed" value={v.value}
                          onChange={(e) => setVariables(variables.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                        <button onClick={() => setVariables(variables.filter((_, j) => j !== i))}
                          className="text-ink-400 hover:text-signal-red">🗑</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {testOpen && (
                <div className="rounded-xl border border-ink-700 bg-ink-950 p-4">
                  <p className="text-xs font-semibold text-ink-300">Sample payload this webhook will receive:</p>
                  <pre className="mt-2 overflow-x-auto text-xs text-accent-300">
                    {JSON.stringify(samplePayload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-signal-red/40 bg-signal-red/10 px-4 py-3 text-sm text-signal-red">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink-700 px-6 py-4">
          {step === 0 ? (
            <button onClick={onClose} className="btn-secondary">Cancel</button>
          ) : (
            <button onClick={() => setStep(0)} className="btn-secondary">← Previous</button>
          )}
          <div className="flex gap-2">
            {step === 1 && (
              <button onClick={() => setTestOpen(!testOpen)} className="btn-secondary">▶ Test Flow</button>
            )}
            {step === 0 ? (
              <button onClick={() => {
                if (!/^https:\/\/.+/.test(url)) return setError("Enter a valid https:// URL first.");
                setError(null); setStep(1);
              }} className="btn-primary">Next</button>
            ) : (
              <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">
                {busy ? "Saving…" : "💾 Save"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
