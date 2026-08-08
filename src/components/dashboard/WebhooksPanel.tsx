"use client";
import {
  Search, RefreshCw, Trash2, Zap, X, Check, Save, Plus, Pencil,
  ArrowLeft, ArrowRight, Play,
} from "lucide-react";
import RowMenu from "./RowMenu";
import { toast, toastError } from "@/components/Toast";

// Webhooks: searchable list, "Choose Webhook Template" modal (Start from
// Scratch + template gallery), and the two-step "Create Custom Webhook"
// builder (Details → Steps) matching the Callab reference: Basic
// Information + Predefined Variables, then Webhook Steps (Add Step modal)
// + Custom Variables with a Test Flow runner.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import type { Webhook, WebhookStep, WebhookVariable } from "@/lib/db";

export default function WebhooksPanel({ webhooks }: { webhooks: Webhook[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [chooser, setChooser] = useState(false);
  const [builder, setBuilder] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return webhooks.filter(
      (w) => !q || `${w.name ?? ""} ${w.url} ${w.events.join(" ")}`.toLowerCase().includes(q)
    );
  }, [webhooks, query]);

  async function remove(w: Webhook) {
    if (!confirm(`Delete webhook "${w.name ?? w.url}"?`)) return;
    await fetch(`/api/webhooks/${w.id}`, { method: "DELETE" });
    toast("Webhook deleted.");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
          <p className="mt-1 text-sm text-ink-400">
            Configure webhooks to send data to external services
          </p>
        </div>
        <button onClick={() => setChooser(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add Webhook
        </button>
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 text-ink-400">
            <Plus className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold">No webhooks found</p>
          <p className="mt-1 text-sm text-ink-400">Get started by adding your first webhook</p>
          <button onClick={() => setChooser(true)} className="btn-primary mt-5 flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add Webhook
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((w) => (
            <div key={w.id} className="card card-hover relative !p-5">
              <div className="flex items-start justify-between">
                <h2 className="text-sm font-semibold">{w.name ?? "Webhook"}</h2>
                <RowMenu
                  items={[{ label: "Delete", icon: Trash2, danger: true, onClick: () => remove(w) }]}
                />
              </div>
              <p className="mt-1.5 break-all font-mono text-xs text-ink-300">{w.url}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {w.events.map((e) => <span key={e} className="badge-muted">{e}</span>)}
                {(w.steps?.length ?? 0) > 0 && (
                  <span className="badge-warn inline-flex items-center gap-1"><Zap className="h-3 w-3" /> {w.steps!.length} step{w.steps!.length === 1 ? "" : "s"}</span>
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
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-ink-500">
              <Plus className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold">Start from Scratch</span>
              <span className="block text-sm text-ink-400">Create a custom webhook with your own configuration</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-ink-400" />
        </button>
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"><Search className="h-4 w-4" /></span>
            <input className="field !pl-10" placeholder="Search templates..." />
          </div>
          <button aria-label="Refresh templates" className="btn-secondary !px-3.5 !py-2.5"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-ink-600 py-12 text-center text-sm text-ink-400">
          <Search className="mx-auto h-7 w-7 text-ink-400" />
          <p className="mt-3">No templates available</p>
          <p className="mt-1 text-xs">Check back later for new templates</p>
        </div>
      </Modal>

      {builder && (
        <WebhookBuilder onClose={() => setBuilder(false)}
          onSaved={() => { setBuilder(false); toast("Webhook saved."); router.refresh(); }} />
      )}
    </div>
  );
}

// --- Create Custom Webhook (2-step wizard) -----------------------------------

const WIZ_STEPS = ["Details", "Steps"];

function WebhookBuilder({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Details
  const [name, setName] = useState("");
  const [predefined, setPredefined] = useState<{ key: string; value: string }[]>([]);

  // Steps
  const [steps, setSteps] = useState<WebhookStep[]>([]);
  const [variables, setVariables] = useState<WebhookVariable[]>([]);
  const [stepModal, setStepModal] = useState<{ open: boolean; index?: number } | null>(null);

  // New-variable form
  const [nvName, setNvName] = useState("");
  const [nvPath, setNvPath] = useState("");
  const [nvSourceType, setNvSourceType] = useState<"response" | "static">("response");
  const [nvSourceStep, setNvSourceStep] = useState("");
  const [nvDataType, setNvDataType] = useState<"string" | "number" | "boolean">("string");
  const [nvValue, setNvValue] = useState("");

  // Test Flow
  const [testBusy, setTestBusy] = useState(false);
  const [testResults, setTestResults] = useState<{ name: string; method: string; ok: boolean; status: number | string }[] | null>(null);

  function addVariable() {
    if (!nvName.trim() || (nvSourceType === "response" && !nvPath.trim())) {
      setError("Variable Name and JSON Path Location are required.");
      return;
    }
    setError(null);
    setVariables((v) => [
      ...v,
      {
        name: nvName.trim(),
        jsonPath: nvPath.trim(),
        sourceType: nvSourceType,
        sourceStep: nvSourceStep || undefined,
        dataType: nvDataType,
        value: nvValue || undefined,
      },
    ]);
    setNvName(""); setNvPath(""); setNvValue("");
  }

  const payload = () => ({
    name,
    steps,
    variables,
    predefinedVariables: Object.fromEntries(predefined.filter((p) => p.key).map((p) => [p.key, p.value])),
  });

  async function testFlow() {
    if (steps.length === 0) return setError("Add at least one step to test the flow.");
    setTestBusy(true);
    setError(null);
    setTestResults(null);
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload(), test: true }),
    });
    const data = await res.json().catch(() => ({}));
    setTestBusy(false);
    if (Array.isArray(data.results)) {
      setTestResults(data.results);
      if (data.ok) toast("Test flow completed successfully.");
      else toastError("Test flow failed — check the step results below.");
    } else {
      setError(data.error ?? "Could not run the test flow.");
    }
  }

  async function save() {
    if (steps.length === 0) return setError("Add at least one step before saving.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    if (res.ok) onSaved();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      toastError(data.error ?? "Could not save the webhook.");
      setBusy(false);
    }
  }

  function stepCircle(i: number) {
    const active = i === step;
    const done = i < step;
    return (
      <div key={WIZ_STEPS[i]} className={`flex items-center ${i > 0 ? "flex-1" : ""}`}>
        {i > 0 && <span className={`mx-2 h-px flex-1 ${i <= step ? "bg-[#301C3F]" : "bg-ink-700"}`} />}
        <button onClick={() => i < step && setStep(i)} className="flex flex-col items-center gap-1">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
              done ? "bg-[#301C3F] text-white" : active ? "border-2 border-[#301C3F] text-[#301C3F]" : "border border-ink-700 text-ink-400"
            }`}
          >
            {done ? <Check className="h-4 w-4" /> : i + 1}
          </span>
          <span className={`text-[11px] ${active ? "font-semibold text-ink-100" : "text-ink-400"}`}>{WIZ_STEPS[i]}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div className="flex h-full w-full max-w-4xl flex-col border-l border-ink-700 bg-ink-950">
        <div className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
          <h2 className="text-lg font-bold">Create Custom Webhook</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex items-center px-10 py-5">{WIZ_STEPS.map((_, i) => stepCircle(i))}</div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          {step === 0 && (
            <>
              <div className="card !p-6">
                <h3 className="text-base font-semibold">Basic Information</h3>
                <p className="mt-0.5 text-sm text-ink-400">Define the core properties of your webhook, including its name and workspace.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Workspace</label>
                    <select className="field"><option>Default Workspace</option></select>
                  </div>
                  <div>
                    <label className="label">Webhook Name</label>
                    <input className="field" placeholder="My Custom Webhook"
                      value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="card !p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Predefined Variables</h3>
                    <p className="mt-0.5 text-sm text-ink-400">Manage your global variables and secrets</p>
                  </div>
                  <button
                    onClick={() => setPredefined((p) => [...p, { key: "", value: "" }])}
                    className="btn-secondary flex items-center gap-1.5 !text-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Variable
                  </button>
                </div>
                <ul className="mt-4 list-inside space-y-1 rounded-xl bg-accent-500/5 px-4 py-3 text-xs text-ink-300">
                  <li>• Define static values like API keys or secret tokens that can be used throughout your integration flow.</li>
                  <li>• These variables are available to all steps in the integration.</li>
                  <li>• Use the <code className="rounded bg-ink-800 px-1">{"{{variableName}}"}</code> syntax to reference the variable in your steps.</li>
                </ul>
                <div className="mt-3 space-y-2">
                  {predefined.length === 0 && (
                    <p className="rounded-xl border border-dashed border-ink-600 py-10 text-center text-sm text-ink-400">
                      No predefined variables added yet.{" "}
                      <button onClick={() => setPredefined([{ key: "", value: "" }])} className="font-medium text-ink-100 underline-offset-2 hover:underline">
                        Add your first variable
                      </button>
                    </p>
                  )}
                  {predefined.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <input className="field w-48 font-mono !text-[13px]" placeholder="variable_name" value={p.key}
                        onChange={(e) => setPredefined(predefined.map((x, j) => (j === i ? { ...x, key: e.target.value.replace(/[^\w.-]/g, "_") } : x)))} />
                      <input className="field flex-1 font-mono !text-[13px]" placeholder="value" value={p.value}
                        onChange={(e) => setPredefined(predefined.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                      <button onClick={() => setPredefined(predefined.filter((_, j) => j !== i))}
                        aria-label="Remove variable"
                        className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="card !p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Webhook Steps</h3>
                    <p className="mt-0.5 text-sm text-ink-400">Configure the flow of your webhook integration</p>
                  </div>
                  <button onClick={() => setStepModal({ open: true })} className="btn-primary flex items-center gap-1.5 !text-sm">
                    <Plus className="h-3.5 w-3.5" /> Add Step
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {steps.length === 0 && (
                    <p className="rounded-xl border border-dashed border-ink-600 py-12 text-center text-sm text-ink-400">
                      No steps added yet
                      <span className="block text-xs">Click Add Step to define the webhook flow</span>
                    </p>
                  )}
                  {steps.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-ink-700 px-4 py-3">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <span className="rounded bg-[#301C3F]/10 px-2 py-0.5 text-[11px] font-bold text-[#301C3F]">{s.method}</span>
                          {s.name || `Step ${i + 1}`}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-xs text-ink-400">{s.url}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <button onClick={() => setStepModal({ open: true, index: i })}
                          aria-label="Edit step"
                          className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                          aria-label="Remove step"
                          className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card !p-6">
                <h3 className="text-base font-semibold">Custom Variables</h3>
                <p className="mt-0.5 text-sm text-ink-400">Define variables that can be used within your webhook steps</p>
                <ul className="mt-3 list-inside space-y-1 rounded-xl bg-accent-500/5 px-4 py-3 text-xs text-ink-300">
                  <li>• Define variables here to pass data between different steps in your flow.</li>
                  <li>• For example, use the output of an API call in one step as an input to another.</li>
                  <li>• Variables are referenced by their name (e.g., <code className="rounded bg-ink-800 px-1">user_id</code>) and can be sourced from previous step responses or have custom static values.</li>
                </ul>

                <div className="mt-4 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Add New Variable</h4>
                  <button onClick={addVariable} className="btn-primary flex items-center gap-1.5 !px-3 !py-1.5 !text-xs">
                    <Plus className="h-3 w-3" /> Add Variable
                  </button>
                </div>
                <div className="mt-3 grid gap-3 rounded-xl border border-ink-700 p-4 sm:grid-cols-3">
                  <div>
                    <label className="label !text-xs">Variable Name</label>
                    <input className="field !py-2 !text-[13px]" placeholder="e.g., user_id, extracted_data"
                      value={nvName} onChange={(e) => setNvName(e.target.value.replace(/[^\w.-]/g, "_"))} />
                  </div>
                  <div>
                    <label className="label !text-xs">JSON Path Location *</label>
                    <input className="field !py-2 !text-[13px]" placeholder="e.g., data.user.id, response.body"
                      value={nvPath} onChange={(e) => setNvPath(e.target.value)} />
                  </div>
                  <div>
                    <label className="label !text-xs">Source Type</label>
                    <select className="field !py-2 !text-[13px]" value={nvSourceType}
                      onChange={(e) => setNvSourceType(e.target.value as "response" | "static")}>
                      <option value="response">Response</option>
                      <option value="static">Static value</option>
                    </select>
                  </div>
                  <div>
                    <label className="label !text-xs">Source Step</label>
                    <select className="field !py-2 !text-[13px]" value={nvSourceStep} onChange={(e) => setNvSourceStep(e.target.value)}>
                      <option value="">Select step</option>
                      {steps.map((s, i) => (
                        <option key={i} value={s.name || `Step ${i + 1}`}>{s.name || `Step ${i + 1}`} — {s.method}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label !text-xs">Data Type</label>
                    <select className="field !py-2 !text-[13px]" value={nvDataType}
                      onChange={(e) => setNvDataType(e.target.value as "string" | "number" | "boolean")}>
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>
                  <div>
                    <label className="label !text-xs">Custom Value (Optional)</label>
                    <input className="field !py-2 !text-[13px]" placeholder="Enter static value if needed"
                      value={nvValue} onChange={(e) => setNvValue(e.target.value)} />
                  </div>
                </div>

                <h4 className="mt-5 text-sm font-semibold">Existing Variables</h4>
                <div className="mt-2 space-y-2">
                  {variables.length === 0 && (
                    <p className="rounded-xl border border-dashed border-ink-600 py-8 text-center text-sm text-ink-400">
                      No variables yet.
                    </p>
                  )}
                  {variables.map((v, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-ink-700 px-4 py-2.5 text-sm">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <code className="rounded bg-[#301C3F]/10 px-2 py-0.5 text-[12px] font-semibold text-[#301C3F]">{v.name}</code>
                        <span className="truncate font-mono text-xs text-ink-400">{v.jsonPath || v.value || "—"}</span>
                        <span className="badge-muted !text-[10px]">{v.sourceType}</span>
                        <span className="badge-muted !text-[10px]">{v.dataType}</span>
                      </span>
                      <button onClick={() => setVariables(variables.filter((_, j) => j !== i))}
                        aria-label="Remove variable"
                        className="shrink-0 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {testResults && (
                <div className="card !p-5">
                  <h4 className="text-sm font-semibold">Test Flow Results</h4>
                  <div className="mt-2 space-y-1.5">
                    {testResults.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 px-3 py-2 text-xs">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="rounded bg-[#301C3F]/10 px-1.5 py-0.5 font-bold text-[#301C3F]">{r.method}</span>
                          <span className="truncate">{r.name}</span>
                        </span>
                        <span className={r.ok ? "badge-ok" : "badge-muted !text-signal-red"}>{r.ok ? `OK · ${r.status}` : String(r.status)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-4 py-3 text-sm text-signal-red">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink-700 px-6 py-4">
          <button
            onClick={() => (step === 0 ? onClose() : setStep(0))}
            className="btn-secondary flex items-center gap-1.5"
          >
            {step === 0 ? "Cancel" : (<><ArrowLeft className="h-4 w-4" /> Previous</>)}
          </button>
          {step === 0 ? (
            <button
              onClick={() => {
                if (!name.trim()) return setError("Webhook Name is required.");
                setError(null);
                setStep(1);
              }}
              className="btn-primary flex items-center gap-1.5"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={testFlow} disabled={testBusy}
                className="btn-secondary flex items-center gap-1.5 disabled:opacity-60">
                <Play className="h-4 w-4" /> {testBusy ? "Testing…" : "Test Flow"}
              </button>
              <button onClick={save} disabled={busy} className="btn-primary flex items-center gap-1.5 disabled:opacity-60">
                <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {stepModal?.open && (
          <WebhookStepModal
            editing={stepModal.index !== undefined ? steps[stepModal.index] : undefined}
            onClose={() => setStepModal(null)}
            onSave={(s) => {
              setSteps((prev) =>
                stepModal.index !== undefined ? prev.map((x, i) => (i === stepModal.index ? s : x)) : [...prev, s]
              );
              setStepModal(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// --- Add New Webhook Step modal ----------------------------------------------

function WebhookStepModal({
  editing,
  onClose,
  onSave,
}: {
  editing?: WebhookStep;
  onClose: () => void;
  onSave: (s: WebhookStep) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [method, setMethod] = useState<WebhookStep["method"]>(editing?.method ?? "POST");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">{editing ? "Edit Webhook Step" : "Add New Webhook Step"}</h3>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Step Name</label>
              <input className="field" placeholder="e.g., Fetch contacts" value={name}
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="field" value={method} onChange={(e) => setMethod(e.target.value as WebhookStep["method"])}>
                {["POST", "GET", "PUT"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">URL *</label>
            <input className="field" placeholder="Enter URL (e.g., https://api.example.com/webhook)" value={url}
              onChange={(e) => setUrl(e.target.value)} />
            <p className="mt-1 text-xs text-ink-400">Use <code className="rounded bg-ink-800 px-1">{"{{variableName}}"}</code> to reference predefined or custom variables.</p>
          </div>
          {error && <p className="text-sm text-signal-red">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => {
              if (!/^https:\/\/.+/.test(url)) return setError("Enter a valid https:// URL.");
              onSave({ name: name.trim(), method, url: url.trim() });
            }}
            className="btn-primary"
          >
            {editing ? "Save Step" : "Add Step"}
          </button>
        </div>
      </div>
    </div>
  );
}
