"use client";

// Create Campaign flow:
//   1) "Select Campaign Type" modal (Inbound / Outbound)
//   2) Slide-over wizard with a step progress header:
//        Outbound: Campaign Info → Date & Time → Contact Filters →
//                  Agent Variables → Webhook
//        Inbound:  Campaign Info → Webhook

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { toast, toastError } from "@/components/Toast";
import { PhoneIncoming, PhoneOutgoing, X, Check, Rocket } from "lucide-react";
import type { Agent, Contact, PhoneNumber, Webhook } from "@/lib/db";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMEZONES = [
  "UTC",
  "America/New_York (GMT-5)",
  "America/Los_Angeles (GMT-8)",
  "Europe/London (GMT+0)",
  "Europe/Berlin (GMT+1)",
  "Asia/Dubai (GMT+4)",
  "Asia/Karachi (GMT+5)",
  "Asia/Singapore (GMT+8)",
];
const SOURCES = ["Manual", "Import", "Integration"];

// Pull {{variable}} tokens out of the agent's prompt text so the
// Agent Variables step can offer mappings for them.
function extractVariables(agent?: Agent): string[] {
  if (!agent) return [];
  const text = `${agent.identity ?? ""} ${agent.tasks ?? ""} ${agent.greeting ?? ""} ${agent.systemPrompt ?? ""}`;
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) found.add(m[1]);
  return [...found];
}

interface Props {
  agents: Agent[];
  phoneNumbers: PhoneNumber[];
  webhooks: Webhook[];
  contacts: Contact[];
}

export default function CampaignWizard({ agents, phoneNumbers, webhooks, contacts }: Props) {
  const router = useRouter();
  const [typeModal, setTypeModal] = useState(false);
  const [direction, setDirection] = useState<"inbound" | "outbound" | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState(TIMEZONES[0]);
  const [syncWithContact, setSyncWithContact] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [days, setDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [retryAttempts, setRetryAttempts] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [csvContacts, setCsvContacts] = useState<Record<string, string>[]>([]);
  const [csvName, setCsvName] = useState("");
  const [csvError, setCsvError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [webhookId, setWebhookId] = useState("");

  const steps =
    direction === "outbound"
      ? ["Campaign Info", "Date & Time", "Contact Filters", "Agent Variables", "Webhook"]
      : ["Campaign Info", "Webhook"];

  const agent = agents.find((a) => a.id === agentId);
  const variables = useMemo(() => extractVariables(agent), [agent]);
  const allTags = useMemo(() => [...new Set(contacts.map((c) => c.tag))], [contacts]);
  const matching = useMemo(
    () => (tags.length ? contacts.filter((c) => tags.includes(c.tag)) : contacts),
    [contacts, tags]
  );

  function reset() {
    setDirection(null);
    setStep(0);
    setError(null);
    setName("");
    setDescription("");
    setAgentId("");
    setPhoneNumber("");
    setTags([]);
    setSources([]);
    setCsvContacts([]);
    setCsvName("");
    setCsvError(null);
    setMapping({});
    setWebhookId("");
  }

  function pickType(d: "inbound" | "outbound") {
    setTypeModal(false);
    setDirection(d);
    setStep(0);
  }

  // Parse an uploaded CSV: needs a "number" (or "phone") column; every other
  // column becomes a dynamic variable passed to the agent per contact.
  function onCsv(file: File) {
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) throw new Error("empty");
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const numIdx = headers.findIndex((h) => h === "number" || h === "phone" || h === "phone_number");
        if (numIdx < 0) throw new Error("no number column");
        const rows = lines.slice(1).map((line) => {
          const cells = line.split(",").map((c) => c.trim());
          const row: Record<string, string> = { number: (cells[numIdx] ?? "").replace(/[^+0-9]/g, "") };
          headers.forEach((h, i) => {
            if (i !== numIdx && cells[i]) row[h === "phone" || h === "phone_number" ? "extra" : h] = cells[i];
          });
          return row;
        }).filter((r) => /^\+?\d{7,15}$/.test(r.number));
        if (rows.length === 0) throw new Error("no valid numbers");
        setCsvContacts(rows);
        setCsvName(file.name);
      } catch (e) {
        setCsvError(
          (e as Error).message === "no number column"
            ? "The CSV needs a 'number' column. Download the template for the exact format."
            : "Could not read that CSV — check it has a header row and a 'number' column."
        );
        setCsvContacts([]);
        setCsvName("");
      }
    };
    reader.readAsText(file);
  }

  function validateStep(): string | null {
    if (steps[step] === "Campaign Info") {
      if (!name.trim()) return "Campaign name is required.";
      if (!agentId) return "Select an AI agent.";
    }
    return null;
  }

  function next() {
    const problem = validateStep();
    if (problem) return setError(problem);
    setError(null);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  async function launch() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        agentId,
        phoneNumber,
        direction,
        syncWithContact,
        schedule: { startDate, endDate, from, to, days, timezone, retryAttempts },
        filters: { sources, tags, categories: [] },
        csvContacts,
        variableMapping: mapping,
        webhookId,
      }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.launchError) {
        toastError(data.launchError);
      } else {
        toast(
          data.launched
            ? `Campaign launched — Vapi is dialing ${data.launched} contact${data.launched === 1 ? "" : "s"}.`
            : "Campaign created."
        );
      }
      reset();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  function chipToggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const stepName = steps[step];

  return (
    <>
      <button onClick={() => setTypeModal(true)} className="btn-primary">
        + Create Campaign
      </button>

      {/* Type selection */}
      <Modal open={typeModal} onClose={() => setTypeModal(false)} title="Select Campaign Type" wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={() => pickType("inbound")} className="card card-hover flex flex-col items-center !p-8 text-center">
            <PhoneIncoming className="h-7 w-7 text-ink-300" />
            <span className="mt-3 text-base font-semibold">Inbound</span>
            <span className="mt-1 text-sm text-ink-400">Receive calls to your AI agent</span>
          </button>
          <button onClick={() => pickType("outbound")} className="card card-hover flex flex-col items-center !p-8 text-center">
            <PhoneOutgoing className="h-7 w-7 text-ink-300" />
            <span className="mt-3 text-base font-semibold">Outbound</span>
            <span className="mt-1 text-sm text-ink-400">Make calls from your AI agent</span>
          </button>
        </div>
      </Modal>

      {/* Wizard slide-over */}
      {direction && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && reset()}>
          <div className="flex h-full w-full max-w-3xl flex-col border-l border-ink-700 bg-ink-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
              <h2 className="text-lg font-bold">
                Create {direction === "outbound" ? "Outbound" : "Inbound"} Campaign
              </h2>
              <button onClick={reset} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2 border-b border-ink-700 px-6 py-5">
              {steps.map((s, i) => (
                <div key={s} className="flex flex-1 items-center gap-2 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        i < step
                          ? "grad-bg text-white"
                          : i === step
                            ? "border-2 border-accent-500 bg-ink-800 text-accent-300"
                            : "bg-ink-800 text-ink-400"
                      }`}
                    >
                      {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className={`whitespace-nowrap text-[11px] ${i === step ? "font-semibold text-ink-100" : "text-ink-400"}`}>
                      {s}
                    </span>
                  </div>
                  {i < steps.length - 1 && <div className="mb-5 h-px flex-1 bg-ink-700" />}
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {stepName === "Campaign Info" && (
                <div className="space-y-4">
                  {phoneNumbers.length === 0 && (
                    <p className="rounded-lg border border-signal-amber/40 bg-signal-amber/10 px-4 py-3 text-sm text-signal-amber">
                      ⓘ You need at least one phone number before calls can run — add one in Phone Numbers.
                    </p>
                  )}
                  <div>
                    <label className="label">Campaign Name *</label>
                    <input className="field" placeholder="Enter campaign name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Description (Optional)</label>
                    <textarea rows={3} className="field" placeholder="Brief description of the campaign" value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">AI Agent *</label>
                    <select className="field" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                      <option value="">Select AI Agent</option>
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">
                      {direction === "outbound" ? "Outbound" : "Inbound"} Phone Number *
                    </label>
                    <select className="field" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}>
                      <option value="">Select Phone Number</option>
                      {phoneNumbers.map((p) => (
                        <option key={p.id} value={p.number}>{p.number} — {p.agentName || p.provider}</option>
                      ))}
                    </select>
                  </div>
                  {direction === "inbound" && (
                    <>
                      <div>
                        <label className="label">Timezone</label>
                        <select className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                          {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <label className="flex items-start gap-3 text-sm">
                        <input type="checkbox" className="mt-1 h-4 w-4 accent-accent-500" checked={syncWithContact} onChange={(e) => setSyncWithContact(e.target.checked)} />
                        <span>
                          <span className="font-medium">Sync with contact</span>
                          <span className="block text-xs text-ink-400">Automatically sync inbound calls with contact records</span>
                        </span>
                      </label>
                    </>
                  )}
                </div>
              )}

              {stepName === "Date & Time" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Start Date</label>
                      <input type="date" className="field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">End Date (Optional)</label>
                      <input type="date" className="field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      <p className="mt-1 text-xs text-ink-400">Leave blank for an ongoing campaign</p>
                    </div>
                    <div>
                      <label className="label">Call Time — From</label>
                      <input type="time" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Call Time — To</label>
                      <input type="time" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Days of Week</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((d) => (
                        <button key={d} onClick={() => chipToggle(days, setDays, d)}
                          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                            days.includes(d) ? "grad-bg text-white" : "bg-ink-800 text-ink-300 hover:text-ink-100"
                          }`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Timezone</label>
                    <select className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-accent-500" checked={retryAttempts} onChange={(e) => setRetryAttempts(e.target.checked)} />
                    Enable retry attempts
                  </label>
                </div>
              )}

              {stepName === "Contact Filters" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-semibold">Who to call</h3>
                    <p className="text-sm text-ink-400">
                      Upload a CSV of numbers, or pick existing contacts by tag. CSV takes priority when provided.
                    </p>
                  </div>

                  {/* CSV upload */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="label !mb-0">Upload CSV</label>
                      <a
                        href={"data:text/csv;charset=utf-8," + encodeURIComponent("number,name,another_var\n+14155550142,John Doe,Hello\n")}
                        download="campaign-template.csv"
                        className="text-xs font-medium text-[#301C3F] underline-offset-2 hover:underline"
                      >
                        Download template
                      </a>
                    </div>
                    <label className="mt-1.5 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-ink-600 px-4 py-6 text-center transition hover:border-ink-400">
                      <input type="file" accept=".csv,text/csv" className="hidden"
                        onChange={(e) => e.target.files?.[0] && onCsv(e.target.files[0])} />
                      <span className="text-sm text-ink-300">
                        {csvName ? (
                          <span className="font-medium text-emerald-600">{csvName} — {csvContacts.length} numbers loaded</span>
                        ) : (
                          "Drag a CSV here or click to choose. Needs a 'number' column; extra columns become dynamic variables."
                        )}
                      </span>
                    </label>
                    {csvError && <p className="mt-1.5 text-xs text-signal-red">{csvError}</p>}
                    {csvContacts.length > 0 && (
                      <button onClick={() => { setCsvContacts([]); setCsvName(""); }}
                        className="mt-1.5 text-xs text-ink-400 hover:text-signal-red">Clear CSV</button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-ink-700" />
                    <span className="text-xs text-ink-500">or pick existing contacts</span>
                    <div className="h-px flex-1 bg-ink-700" />
                  </div>
                  <div>
                    <label className="label">Contact Sources</label>
                    <div className="flex flex-wrap gap-2">
                      {SOURCES.map((s) => (
                        <button key={s} onClick={() => chipToggle(sources, setSources, s)}
                          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                            sources.includes(s) ? "grad-bg text-white" : "bg-ink-800 text-ink-300 hover:text-ink-100"
                          }`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Contact Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((t) => (
                        <button key={t} onClick={() => chipToggle(tags, setTags, t)}
                          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                            tags.includes(t) ? "grad-bg text-white" : "bg-ink-800 text-ink-300 hover:text-ink-100"
                          }`}>
                          {t}
                        </button>
                      ))}
                      {allTags.length === 0 && (
                        <p className="text-sm text-ink-400">No tags yet — add contacts first.</p>
                      )}
                    </div>
                  </div>
                  {/* Matching preview */}
                  <div className="card !p-0">
                    <p className="border-b border-ink-700 px-4 py-2.5 text-xs font-semibold text-ink-300">
                      Preview — {matching.length} matching contact{matching.length === 1 ? "" : "s"}
                    </p>
                    <div className="max-h-44 overflow-y-auto">
                      {matching.slice(0, 8).map((c) => (
                        <div key={c.id} className="flex items-center justify-between border-b border-ink-700/50 px-4 py-2 text-sm last:border-0">
                          <span>{c.name}</span>
                          <span className="font-mono text-xs text-ink-400">{c.phone}</span>
                          <span className="badge-muted">{c.tag}</span>
                        </div>
                      ))}
                      {matching.length === 0 && (
                        <p className="px-4 py-4 text-sm text-ink-400">No contacts match these filters.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {stepName === "Agent Variables" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold">Agent Dynamic Variable Mapping</h3>
                    <p className="text-sm text-ink-400">
                      Map data sources to the dynamic variables used by your selected AI Agent.
                    </p>
                  </div>
                  {variables.length === 0 ? (
                    <div className="card py-8 text-center text-sm text-ink-400">
                      The selected AI Agent has no dynamic variables defined.
                      <p className="mt-1.5 text-xs text-ink-500">
                        Tip: write {"{{variable_name}}"} in the agent&apos;s prompt to create one.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {variables.map((v) => (
                        <div key={v} className="flex items-center gap-3">
                          <code className="w-44 rounded-lg bg-ink-800 px-3 py-2 text-xs text-accent-300">{`{{${v}}}`}</code>
                          <select className="field flex-1" value={mapping[v] ?? ""}
                            onChange={(e) => setMapping({ ...mapping, [v]: e.target.value })}>
                            <option value="">Map to…</option>
                            <option value="contact.name">Contact name</option>
                            <option value="contact.phone">Contact phone</option>
                            <option value="contact.tag">Contact tag</option>
                            <option value="campaign.name">Campaign name</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {stepName === "Webhook" && (
                <div className="space-y-4">
                  <div>
                    <label className="label">Webhook Flow (Optional)</label>
                    <select className="field" value={webhookId} onChange={(e) => setWebhookId(e.target.value)}>
                      <option value="">None</option>
                      {webhooks.map((w) => <option key={w.id} value={w.id}>{w.url}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-ink-400">Connect a webhook flow to trigger on call events.</p>
                  </div>
                  <div className="card py-8 text-center text-sm text-ink-400">
                    {webhookId
                      ? `Call events for this campaign will POST to the selected endpoint.`
                      : "Please select a Webhook Flow to see its variables for mapping."}
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-4 rounded-lg border border-signal-red/40 bg-signal-red/10 px-4 py-3 text-sm text-signal-red">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-ink-700 px-6 py-4">
              {step === 0 ? (
                <button onClick={reset} className="btn-secondary">Cancel</button>
              ) : (
                <button onClick={() => setStep(step - 1)} className="btn-secondary">Previous</button>
              )}
              {step < steps.length - 1 ? (
                <button onClick={next} className="btn-primary">Next</button>
              ) : (
                <button onClick={launch} disabled={busy} className="btn-primary disabled:opacity-60">
                  {busy ? "Launching…" : (<span className="flex items-center gap-1.5"><Rocket className="h-4 w-4" /> Launch your AI</span>)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
