"use client";

// Integrations — matches the reference design:
//  - Cards: initials avatar, status dot, tag/category chips, "N steps
//    workflow / N seconds interval" box, big Start + Execute buttons, and a
//    three-dots menu (Edit / Duplicate / View History / Test Flow / Delete)
//  - Add Integration → "Choose Integration Template" (Start from Scratch +
//    template gallery)
//  - Start from Scratch → 3-step "Add Custom Integration" wizard
//    (General → Steps & Variables → Mapping) with the Add-Step modal
// Flows genuinely execute server-side; Execute imports contacts via the
// field mapping.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  RefreshCw,
  Tag,
  FolderOpen,
  Zap,
  Clock,
  Play,
  Pencil,
  Copy,
  History,
  FlaskConical,
  Trash2,
  X,
  Plus,
  ArrowRight,
  ArrowLeft,
  Check,
  MessageCircle,
} from "lucide-react";
import { toast, toastError } from "@/components/Toast";
import type { Integration, IntegrationFlowStep, IntegrationVariable } from "@/lib/db";
import RowMenu from "./RowMenu";

interface Platform {
  name: string;
  detail: string;
  connected: boolean;
  hint: string;
}

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  idle: { label: "Not started", cls: "badge-muted", dot: "bg-ink-400" },
  running: { label: "Running", cls: "badge-ok", dot: "bg-emerald-500" },
  stopped: { label: "Stopped", cls: "badge-muted", dot: "bg-ink-400" },
  failed: { label: "Failed", cls: "badge-bad", dot: "bg-red-500" },
  success: { label: "Success", cls: "badge-ok", dot: "bg-emerald-500" },
};

const TEMPLATES: { key: string; name: string; description: string }[] = [
  { key: "crm_import", name: "CRM Campaign Import Contacts", description: "Use this template to create a new integration" },
  { key: "crm_import_auth", name: "CRM Import Contacts with Auth", description: "Use this template to create a new integration" },
];

export default function IntegrationsPanel({
  integrations,
  platforms,
  google,
}: {
  integrations: Integration[];
  platforms: Platform[];
  google?: { configured: boolean; connected: boolean; email: string | null };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [chooser, setChooser] = useState(false);
  const [wizard, setWizard] = useState<{ open: boolean; editing?: Integration; template?: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<Integration | null>(null);
  const [testResult, setTestResult] = useState<{ name: string; ok: boolean; message: string; result: unknown } | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return integrations.filter(
      (i) => !q || `${i.name} ${i.tag} ${i.category}`.toLowerCase().includes(q)
    );
  }, [integrations, query]);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/integrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res;
  }

  async function start(i: Integration) {
    toast(`Running "${i.name}"…`);
    const res = await patch(i.id, { run: true });
    const data = await res.json().catch(() => ({}));
    if (res.ok) toast(data.message ?? "Flow completed.");
    else toastError(data.message ?? "Flow failed — see View History.");
    router.refresh();
  }

  async function testFlow(i: Integration) {
    toast(`Testing "${i.name}"…`);
    const res = await patch(i.id, { test: true });
    const data = await res.json().catch(() => ({}));
    setTestResult({ name: i.name, ok: res.ok, message: data.message ?? "", result: data.result });
    router.refresh();
  }

  async function duplicate(i: Integration) {
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${i.name} (Copy)`,
        tag: i.tag,
        category: i.category,
        intervalSeconds: i.intervalSeconds,
        retryUnit: i.retryUnit,
        maxRetries: i.maxRetries,
        predefinedVariables: i.predefinedVariables,
        flowSteps: i.flowSteps,
        variables: i.variables,
        mapping: i.mapping,
      }),
    });
    toast(`"${i.name}" duplicated.`);
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
        <button onClick={() => setChooser(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add Integration
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

      {/* Integration cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((i) => {
          const meta = STATUS_META[i.status] ?? STATUS_META.idle;
          const stepCount = i.flowSteps?.length ?? i.steps.length;
          return (
            <div key={i.id} className="card !p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-ink-700 bg-ink-800 text-sm font-bold">
                    {i.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <div>
                    <h2 className="text-base font-bold">{i.name}</h2>
                    <span className={`mt-1 inline-flex items-center gap-1.5 ${meta.cls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                    </span>
                  </div>
                </div>
                <RowMenu
                  items={[
                    { label: "Edit", icon: Pencil, onClick: () => setWizard({ open: true, editing: i }) },
                    { label: "Duplicate", icon: Copy, onClick: () => duplicate(i) },
                    { label: "View History", icon: History, onClick: () => setHistoryFor(i) },
                    { label: "Test Flow", icon: FlaskConical, onClick: () => testFlow(i) },
                    { label: "Delete", icon: Trash2, danger: true, onClick: () => remove(i) },
                  ]}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-accent-600">
                {i.tag && <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" /> {i.tag}</span>}
                {i.category && <span className="inline-flex items-center gap-1"><FolderOpen className="h-3 w-3" /> {i.category}</span>}
              </div>

              <div className="mt-3 flex items-center gap-6 rounded-xl border border-ink-700 px-4 py-3">
                <span className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-ink-400" />
                  <span>
                    <span className="block font-semibold">{stepCount} step{stepCount === 1 ? "" : "s"}</span>
                    <span className="block text-xs text-ink-400">workflow</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-500/10">
                    <Clock className="h-3.5 w-3.5 text-accent-600" />
                  </span>
                  <span>
                    <span className="block font-semibold">{i.intervalSeconds} seconds</span>
                    <span className="block text-xs text-ink-400">interval</span>
                  </span>
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {i.status === "running" ? (
                  <button
                    onClick={async () => {
                      await patch(i.id, { status: "stopped" });
                      toast("Integration stopped.");
                      router.refresh();
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
                  >
                    <X className="h-4 w-4" /> Stop
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await patch(i.id, { status: "running" });
                      toast("Integration started.");
                      start(i);
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <Play className="h-4 w-4" /> Start
                  </button>
                )}
                <button
                  onClick={() => start(i)}
                  className="btn-secondary flex items-center justify-center gap-2 !py-2.5 text-sm"
                >
                  <Zap className="h-4 w-4" /> Execute
                </button>
              </div>
              {i.lastRunAt && (
                <p className="mt-2 text-xs text-ink-500">Last run {new Date(i.lastRunAt).toLocaleString()}</p>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-ink-500">
        {visible.length === 0
          ? "No integrations yet — add one to automate contact syncs and data flows."
          : `Showing all ${visible.length} integration${visible.length === 1 ? "" : "s"}`}
      </p>

      {/* Platform connections */}
      <div>
        <h2 className="text-base font-semibold">Platform connections</h2>
        <p className="text-sm text-ink-400">Read from your environment variables — keys are never stored in the database.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {google && <GoogleCalendarCard google={google} />}
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

      {/* Template chooser */}
      {chooser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setChooser(false)}>
          <div
            className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Choose Integration Template</h2>
                <p className="mt-0.5 text-sm text-ink-400">Start from scratch or use a pre-built template to create your integration</p>
              </div>
              <button onClick={() => setChooser(false)} aria-label="Close" className="text-ink-400 hover:text-ink-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => {
                setChooser(false);
                setWizard({ open: true });
              }}
              className="mt-5 flex w-full items-center justify-between rounded-xl border border-ink-700 px-5 py-4 text-left transition hover:bg-ink-800/40"
            >
              <span className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-ink-500">
                  <Plus className="h-4 w-4 text-ink-400" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Start from Scratch</span>
                  <span className="block text-sm text-ink-400">Create a custom integration with your own configuration</span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-ink-400" />
            </button>

            <div className="mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"><Search className="h-4 w-4" /></span>
                <input className="field !pl-10" placeholder="Search templates..." />
              </div>
              <button className="btn-secondary !px-3.5 !py-2.5" aria-label="Refresh templates"><RefreshCw className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setChooser(false);
                    setWizard({ open: true, template: t.key });
                  }}
                  className="card card-hover flex items-start gap-4 !p-5 text-left"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#301C3F]/10">
                    <MessageCircle className="h-7 w-7 text-[#301C3F]" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{t.name}</span>
                    <span className="mt-1 block text-sm text-ink-400">{t.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Wizard */}
      {wizard?.open && (
        <IntegrationWizard
          editing={wizard.editing}
          template={wizard.template}
          onClose={() => setWizard(null)}
          onSaved={() => {
            setWizard(null);
            router.refresh();
          }}
        />
      )}

      {/* History */}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setHistoryFor(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold"><History className="h-4 w-4 text-ink-400" /> Run History</h2>
                <p className="mt-0.5 text-sm text-ink-400">{historyFor.name}</p>
              </div>
              <button onClick={() => setHistoryFor(null)} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-2">
              {(historyFor.runs ?? []).length === 0 && (
                <p className="rounded-xl border border-ink-700 px-4 py-10 text-center text-sm text-ink-400">
                  No runs yet — hit Execute or Test Flow.
                </p>
              )}
              {(historyFor.runs ?? []).map((r, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 rounded-xl border border-ink-700 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className={r.status === "success" ? "badge-ok" : "badge-bad"}>{r.status}</span>
                    <span className="mt-1 block break-words text-xs text-ink-300">{r.message}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-500">{new Date(r.at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setTestResult(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold"><FlaskConical className="h-4 w-4 text-ink-400" /> Test Flow Result</h2>
                <p className="mt-0.5 text-sm text-ink-400">{testResult.name}</p>
              </div>
              <button onClick={() => setTestResult(null)} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
            </div>
            <p className={`mt-4 rounded-lg px-3.5 py-2.5 text-sm ${testResult.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
              {testResult.message || (testResult.ok ? "Flow completed." : "Flow failed.")}
            </p>
            <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-[#0D1526] p-4 font-mono text-[12px] leading-relaxed text-emerald-300">
              {JSON.stringify(testResult.result, null, 2) ?? "null"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Add Custom Integration wizard ------------------------------------------

const WIZ_STEPS = ["General", "Steps & Variables", "Mapping"] as const;

const MAPPING_FIELDS = [
  { key: "name", label: "Contact name" },
  { key: "phone", label: "Phone number" },
  { key: "tag", label: "Tag" },
  { key: "category", label: "Category" },
];

function IntegrationWizard({
  editing,
  template,
  onClose,
  onSaved,
}: {
  editing?: Integration;
  template?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // General
  const [name, setName] = useState(editing?.name ?? (template ? TEMPLATES.find((t) => t.key === template)?.name ?? "" : ""));
  const [tag, setTag] = useState(editing?.tag ?? (template ? "crm" : ""));
  const [category, setCategory] = useState(editing?.category ?? (template ? "CRM" : ""));
  const [retryDelay, setRetryDelay] = useState(editing?.intervalSeconds ?? 20);
  const [retryUnit, setRetryUnit] = useState<string>(editing?.retryUnit ?? "Seconds");
  const [maxRetries, setMaxRetries] = useState(editing?.maxRetries ?? 3);
  const [predefined, setPredefined] = useState<{ key: string; value: string }[]>(
    Object.entries(editing?.predefinedVariables ?? {}).map(([key, value]) => ({ key, value }))
  );

  // Steps & Variables
  const [flowSteps, setFlowSteps] = useState<IntegrationFlowStep[]>(
    editing?.flowSteps ??
      (template
        ? [{
            id: `step_${Math.random().toString(36).slice(2, 10)}`,
            method: "GET" as const,
            url: "https://api.example-crm.com/contacts",
            headers: { "Content-Type": "application/json" },
            timeoutSec: 20,
            retryLimit: 3,
            totalTimeoutSec: 60,
          }]
        : [])
  );
  const [variables, setVariables] = useState<IntegrationVariable[]>(editing?.variables ?? []);
  const [stepModal, setStepModal] = useState<{ open: boolean; editing?: IntegrationFlowStep } | null>(null);

  // New-variable form
  const [nvName, setNvName] = useState("");
  const [nvPath, setNvPath] = useState("");
  const [nvSourceType, setNvSourceType] = useState("response");
  const [nvSourceStep, setNvSourceStep] = useState("");
  const [nvDataType, setNvDataType] = useState("String");
  const [nvCustom, setNvCustom] = useState("");

  // Mapping
  const [mapping, setMapping] = useState<Record<string, string>>(editing?.mapping ?? {});
  const [mappingKeys, setMappingKeys] = useState<string[]>([]);
  const [mappingBusy, setMappingBusy] = useState(false);

  const hasResults = variables.some((v) => v.name === "results");

  function addVariable() {
    if (!nvName.trim() || (nvSourceType === "response" && !nvPath.trim())) return;
    setVariables((v) => [
      ...v,
      {
        name: nvName.trim(),
        jsonPath: nvPath.trim(),
        sourceType: nvSourceType as "response" | "custom",
        sourceStep: nvSourceStep || undefined,
        dataType: nvDataType,
        customValue: nvCustom || undefined,
      },
    ]);
    setNvName(""); setNvPath(""); setNvCustom("");
  }

  async function executeForMapping() {
    setMappingBusy(true);
    setError(null);
    try {
      // Save first (create if new), then test to discover result keys.
      const id = await save(false);
      if (!id) return;
      const res = await fetch(`/api/integrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`Execution failed: ${data.message ?? "check your steps"}`);
        return;
      }
      const result = data.result;
      const sample = Array.isArray(result) ? result[0] : Array.isArray(result?.data) ? result.data[0] : result;
      if (sample && typeof sample === "object") {
        setMappingKeys(Object.keys(sample).slice(0, 40));
        toast("Flow executed — pick the fields below.");
      } else {
        setError("The flow returned no mappable object — check the results variable.");
      }
    } finally {
      setMappingBusy(false);
    }
  }

  const [savedId, setSavedId] = useState<string | null>(editing?.id ?? null);

  async function save(close = true): Promise<string | null> {
    setBusy(true);
    setError(null);
    const payload = {
      name,
      tag,
      category,
      intervalSeconds:
        retryUnit === "Minutes" ? retryDelay * 60 : retryUnit === "Hours" ? retryDelay * 3600 : retryDelay,
      retryUnit,
      maxRetries,
      predefinedVariables: Object.fromEntries(predefined.filter((p) => p.key).map((p) => [p.key, p.value])),
      flowSteps,
      variables,
      mapping,
    };
    const res = savedId
      ? await fetch(`/api/integrations/${savedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/integrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save the integration.");
      return null;
    }
    const id = data.integration?.id ?? savedId;
    setSavedId(id);
    if (close) {
      toast(editing ? "Integration updated." : "Integration created.");
      onSaved();
    }
    return id;
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
          <h2 className="text-lg font-bold">{editing ? "Edit Custom Integration" : "Add Custom Integration"}</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex items-center px-10 py-5">{WIZ_STEPS.map((_, i) => stepCircle(i))}</div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          {step === 0 && (
            <>
              <div className="card !p-6">
                <h3 className="text-base font-semibold">Basic Information</h3>
                <p className="mt-0.5 text-sm text-ink-400">Define the core properties of your integration, including its name and categorization.</p>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="label">Name *</label>
                    <input className="field" placeholder="Enter integration name (e.g., HubSpot Contact Sync)"
                      value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Workspace</label>
                    <select className="field"><option>Default Workspace</option></select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Tag Name *</label>
                      <input className="field" placeholder="Enter tag name (e.g., crm, marketing)"
                        value={tag} onChange={(e) => setTag(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Category Name</label>
                      <input className="field" placeholder="Enter category name (e.g., CRM, Analytics)"
                        value={category} onChange={(e) => setCategory(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card !p-6">
                <h3 className="text-base font-semibold">Retry Configuration</h3>
                <p className="mt-3 text-sm font-medium">Re-execute Delay</p>
                <p className="text-xs text-ink-400">Set the delay before re-executing the integration. This is useful to keep contacts in sync with the source system.</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Re-execute Delay *</label>
                    <input type="number" min={1} className="field" value={retryDelay}
                      onChange={(e) => setRetryDelay(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                  <div>
                    <label className="label">Unit</label>
                    <select className="field" value={retryUnit} onChange={(e) => setRetryUnit(e.target.value)}>
                      <option>Seconds</option>
                      <option>Minutes</option>
                      <option>Hours</option>
                    </select>
                  </div>
                </div>
                <p className="mt-4 text-sm font-medium">Retry Attempts</p>
                <p className="text-xs text-ink-400">Set how many times the integration should retry when it fails.</p>
                <div className="mt-3 sm:max-w-[220px]">
                  <label className="label">Max Retries *</label>
                  <input type="number" min={0} max={10} className="field" value={maxRetries}
                    onChange={(e) => setMaxRetries(Math.max(0, Number(e.target.value) || 0))} />
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
                    <p className="rounded-xl border border-dashed border-ink-600 py-8 text-center text-sm text-ink-400">
                      No predefined variables added yet.
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
              <p className="rounded-xl bg-accent-500/5 px-4 py-3 text-xs text-ink-300">
                Only the result of the final step in the flow will be considered as the overall integration result. The entire
                response object from this last step will be used, unless a specific response key is defined in the success conditions.
              </p>

              <div className="card !p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Integration Flow Steps</h3>
                    <p className="mt-0.5 text-sm text-ink-400">Configure the steps for your integration flow</p>
                  </div>
                  <button onClick={() => setStepModal({ open: true })} className="btn-primary flex items-center gap-1.5 !text-sm">
                    <Plus className="h-3.5 w-3.5" /> Add Flow Step
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {flowSteps.length === 0 && (
                    <p className="rounded-xl border border-dashed border-ink-600 py-10 text-center text-sm text-ink-400">
                      No flow steps added yet
                      <span className="block text-xs">Click &quot;Add Flow Step&quot; to start building your integration flow</span>
                    </p>
                  )}
                  {flowSteps.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-700 px-4 py-3">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <span className="rounded bg-[#301C3F]/10 px-2 py-0.5 text-[11px] font-bold text-[#301C3F]">{s.method}</span>
                          Step {i + 1}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-xs text-ink-400">{s.url}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <button onClick={() => setStepModal({ open: true, editing: s })}
                          aria-label="Edit step"
                          className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setFlowSteps(flowSteps.filter((x) => x.id !== s.id))}
                          aria-label="Remove step"
                          className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {!hasResults && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                  <p className="text-xs text-amber-800">
                    A custom variable named &quot;results&quot; is required. This variable should capture the main output from your flow.
                  </p>
                  <button
                    onClick={() =>
                      setVariables((v) => [
                        ...v,
                        { name: "results", jsonPath: "", sourceType: "response", dataType: "Array" },
                      ])
                    }
                    className="btn-primary flex shrink-0 items-center gap-1.5 !px-3 !py-1.5 !text-xs"
                  >
                    <Plus className="h-3 w-3" /> Add &quot;results&quot; Variable
                  </button>
                </div>
              )}

              <div className="card !p-6">
                <h3 className="text-base font-semibold">Custom Variables</h3>
                <p className="mt-0.5 text-sm text-ink-400">Define variables that can be used within your integration steps</p>
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
                    <select className="field !py-2 !text-[13px]" value={nvSourceType} onChange={(e) => setNvSourceType(e.target.value)}>
                      <option value="response">Response</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="label !text-xs">Source Step</label>
                    <select className="field !py-2 !text-[13px]" value={nvSourceStep} onChange={(e) => setNvSourceStep(e.target.value)}>
                      <option value="">Select step</option>
                      {flowSteps.map((s, i) => (
                        <option key={s.id} value={s.id}>Step {i + 1} — {s.method}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label !text-xs">Data Type</label>
                    <select className="field !py-2 !text-[13px]" value={nvDataType} onChange={(e) => setNvDataType(e.target.value)}>
                      {["String", "Number", "Boolean", "Object", "Array"].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label !text-xs">Custom Value (Optional)</label>
                    <input className="field !py-2 !text-[13px]" placeholder="Enter static value if needed"
                      value={nvCustom} onChange={(e) => setNvCustom(e.target.value)} />
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
                        <span className="truncate font-mono text-xs text-ink-400">{v.jsonPath || v.customValue || "—"}</span>
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
            </>
          )}

          {step === 2 && (
            <div className="card !p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold">Field Mapping</h3>
                <button
                  onClick={executeForMapping}
                  disabled={mappingBusy}
                  className="btn-primary flex items-center gap-2 !text-sm disabled:opacity-60"
                >
                  <Zap className="h-4 w-4" /> {mappingBusy ? "Executing…" : "Execute Flow for Mapping"}
                </button>
              </div>
              <p className="mt-2 text-sm text-ink-400">
                Map fields from your flow&apos;s execution result to standard fields. Execute the flow to populate available fields if you haven&apos;t already.
              </p>
              <div className="mt-5 space-y-4">
                {MAPPING_FIELDS.map((f) => (
                  <div key={f.key} className="grid items-center gap-3 sm:grid-cols-2">
                    <span className="text-sm font-medium">{f.label}</span>
                    {mappingKeys.length > 0 ? (
                      <select className="field"
                        value={mapping[f.key] ?? ""}
                        onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}>
                        <option value="">Not mapped</option>
                        {mappingKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    ) : (
                      <input className="field font-mono !text-[13px]" placeholder="result field, e.g. full_name"
                        value={mapping[f.key] ?? ""}
                        onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-4 py-3 text-sm text-signal-red">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink-700 px-6 py-4">
          <button
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            className="btn-secondary flex items-center gap-1.5"
          >
            {step === 0 ? "Cancel" : (<><ArrowLeft className="h-4 w-4" /> Previous</>)}
          </button>
          {step < 2 ? (
            <button
              onClick={() => {
                if (step === 0 && (!name.trim() || !tag.trim())) return setError("Name and Tag Name are required.");
                if (step === 1 && flowSteps.length === 0) return setError("Add at least one flow step.");
                setError(null);
                setStep(step + 1);
              }}
              className="btn-primary flex items-center gap-1.5"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => save(true)} disabled={busy} className="btn-primary disabled:opacity-60">
              {busy ? "Saving…" : "Save Integration"}
            </button>
          )}
        </div>

        {stepModal?.open && (
          <FlowStepModal
            editing={stepModal.editing}
            steps={flowSteps}
            onClose={() => setStepModal(null)}
            onSave={(s) => {
              setFlowSteps((prev) =>
                stepModal.editing ? prev.map((x) => (x.id === s.id ? s : x)) : [...prev, s]
              );
              setStepModal(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// --- Add New Integration Step modal ------------------------------------------

function FlowStepModal({
  editing,
  steps,
  onClose,
  onSave,
}: {
  editing?: IntegrationFlowStep;
  steps: IntegrationFlowStep[];
  onClose: () => void;
  onSave: (s: IntegrationFlowStep) => void;
}) {
  const [method, setMethod] = useState<"GET" | "POST">(editing?.method ?? "GET");
  const [dependsOn, setDependsOn] = useState(editing?.dependsOn ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(
    Object.entries(editing?.headers ?? {}).map(([key, value]) => ({ key, value }))
  );
  const [hKey, setHKey] = useState("");
  const [hValue, setHValue] = useState("");
  const [timeoutSec, setTimeoutSec] = useState(editing?.timeoutSec ?? 20);
  const [retryLimit, setRetryLimit] = useState(editing?.retryLimit ?? 3);
  const [totalTimeout, setTotalTimeout] = useState(editing?.totalTimeoutSec ?? 60);
  const [hasSuccess, setHasSuccess] = useState(Boolean(editing?.successKey));
  const [successKey, setSuccessKey] = useState(editing?.successKey ?? "");
  const [successValue, setSuccessValue] = useState(editing?.successValue ?? "");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold">{editing ? "Edit Integration Step" : "Add New Integration Step"}</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Method</label>
              <select className="field" value={method} onChange={(e) => setMethod(e.target.value as "GET" | "POST")}>
                <option>GET</option>
                <option>POST</option>
              </select>
            </div>
            <div>
              <label className="label">Depends On Step</label>
              <select className="field" value={dependsOn} onChange={(e) => setDependsOn(e.target.value)}>
                <option value="">None</option>
                {steps.filter((s) => s.id !== editing?.id).map((s, i) => (
                  <option key={s.id} value={s.id}>Step {i + 1} — {s.method}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-400">Which step must succeed before this one runs.</p>
            </div>
          </div>
          <div>
            <label className="label">URL *</label>
            <input className="field font-mono !text-[13px]" placeholder="Enter URL (e.g., https://api.example.com/webhook)"
              value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div>
            <label className="label">Headers</label>
            {headers.length === 0 && <p className="text-xs text-ink-400">No headers added</p>}
            <div className="mt-1 space-y-2">
              {headers.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input className="field flex-1 font-mono !text-[13px]" value={h.key}
                    onChange={(e) => setHeaders(headers.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                  <input className="field flex-1 font-mono !text-[13px]" value={h.value}
                    onChange={(e) => setHeaders(headers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <button onClick={() => setHeaders(headers.filter((_, j) => j !== i))}
                    aria-label="Remove header"
                    className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input className="field flex-1 font-mono !text-[13px]" placeholder="New Header Key"
                  value={hKey} onChange={(e) => setHKey(e.target.value)} />
                <input className="field flex-1 font-mono !text-[13px]" placeholder="New Header Value"
                  value={hValue} onChange={(e) => setHValue(e.target.value)} />
                <button
                  onClick={() => {
                    if (!hKey.trim()) return;
                    setHeaders([...headers, { key: hKey.trim(), value: hValue }]);
                    setHKey(""); setHValue("");
                  }}
                  aria-label="Add header"
                  className="btn-secondary !px-3"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Timeout (sec)</label>
              <input type="number" min={1} className="field" value={timeoutSec}
                onChange={(e) => setTimeoutSec(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div>
              <label className="label">Retry Limit</label>
              <input type="number" min={0} className="field" value={retryLimit}
                onChange={(e) => setRetryLimit(Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </div>
          <div>
            <label className="label">Total Step Timeout (sec)</label>
            <input type="number" min={1} className="field" value={totalTimeout}
              onChange={(e) => setTotalTimeout(Math.max(1, Number(e.target.value) || 1))} />
            <p className="mt-1 text-xs text-ink-400">Max total time including retries.</p>
          </div>
          <label className="flex items-center gap-2.5 text-sm font-medium">
            Success Condition
            <input type="checkbox" className="h-4 w-4 accent-accent-500"
              checked={hasSuccess} onChange={(e) => setHasSuccess(e.target.checked)} />
          </label>
          {hasSuccess && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Response Key</label>
                <input className="field font-mono !text-[13px]" placeholder="e.g. status"
                  value={successKey} onChange={(e) => setSuccessKey(e.target.value)} />
              </div>
              <div>
                <label className="label">Expected Value</label>
                <input className="field font-mono !text-[13px]" placeholder="e.g. ok"
                  value={successValue} onChange={(e) => setSuccessValue(e.target.value)} />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={() =>
                onSave({
                  id: editing?.id ?? `step_${Math.random().toString(36).slice(2, 10)}`,
                  method,
                  url,
                  headers: Object.fromEntries(headers.filter((h) => h.key).map((h) => [h.key, h.value])),
                  timeoutSec,
                  retryLimit,
                  totalTimeoutSec: totalTimeout,
                  dependsOn: dependsOn || undefined,
                  successKey: hasSuccess ? successKey : undefined,
                  successValue: hasSuccess ? successValue : undefined,
                })
              }
              disabled={!/^https?:\/\/.+/.test(url)}
              className="btn-primary disabled:opacity-50"
            >
              {editing ? "Update Step" : "Add Step"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Google Calendar connect card -------------------------------------------
// Each workspace owner connects THEIR OWN Google account; appointments booked
// by agents sync to that account's primary calendar.

function GoogleCalendarCard({
  google,
}: {
  google: { configured: boolean; connected: boolean; email: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    const res = await fetch("/api/integrations/google", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.url) window.location.href = data.url;
    else toastError(data.error ?? "Could not start the Google connection.");
  }

  async function disconnect() {
    if (!confirm("Disconnect Google Calendar? Appointments will stop syncing.")) return;
    setBusy(true);
    await fetch("/api/integrations/google", { method: "DELETE" });
    setBusy(false);
    toast("Google Calendar disconnected.");
    router.refresh();
  }

  return (
    <div className="card card-hover">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">Google Calendar</h3>
        <span className={google.connected ? "badge-ok" : "badge-muted"}>
          {google.connected ? "Connected" : "Not connected"}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-300">
        Appointments your agents book, reschedule or cancel sync to your own Google Calendar
        {google.email ? ` (${google.email})` : ""}. Manage them here or in Google — your choice.
      </p>
      {google.configured ? (
        <button
          onClick={google.connected ? disconnect : connect}
          disabled={busy}
          className={`${google.connected ? "btn-secondary" : "btn-primary"} mt-3 !px-4 !py-2 !text-sm disabled:opacity-60`}
        >
          {busy ? "Working\u2026" : google.connected ? "Disconnect" : "Connect Google Calendar"}
        </button>
      ) : (
        <p className="mt-3 rounded-lg bg-ink-800 px-3 py-2 font-mono text-xs text-ink-300">
          Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your Netlify environment variables.
        </p>
      )}
    </div>
  );
}
