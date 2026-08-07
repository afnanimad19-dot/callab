"use client";

// Full agent editor: details, prompt configuration (or flow designer),
// conversation settings, post-call data extraction, advanced settings,
// plus a Test Agent side panel, publish button, and unsaved-changes bar.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Agent } from "@/lib/db";
import type { AgentAdvanced, AgentOutcome } from "@/lib/agent-defaults";
import { DEFAULT_ADVANCED } from "@/lib/agent-defaults";

const VOICES = [
  "Nova (female, warm)",
  "Atlas (male, calm)",
  "Sage (female, professional)",
  "Orion (male, energetic)",
];
const LANGUAGES = ["English (US)", "English (UK)", "Spanish", "French", "German", "Arabic"];
const BACKGROUND_AUDIO = ["None", "Office ambience", "Call-center murmur", "Soft music"];

type Draft = {
  name: string;
  language: string;
  voice: string;
  backgroundAudio: string;
  identity: string;
  tasks: string;
  guardrails: string;
  whoSpeaksFirst: "agent" | "caller";
  greeting: string;
  status: Agent["status"];
  outcomes: AgentOutcome[];
  advanced: AgentAdvanced;
};

function draftFrom(agent: Partial<Agent>): Draft {
  return {
    name: agent.name ?? "New Agent",
    language: agent.language ?? LANGUAGES[0],
    voice: agent.voice ?? VOICES[0],
    backgroundAudio: agent.backgroundAudio ?? "None",
    identity: agent.identity ?? "",
    tasks: agent.tasks ?? "",
    guardrails: agent.guardrails ?? "",
    whoSpeaksFirst: agent.whoSpeaksFirst ?? "agent",
    greeting: agent.greeting ?? "Hello! Thank you for calling. How can I help you today?",
    status: agent.status ?? "draft",
    outcomes: agent.outcomes ?? [],
    advanced: { ...DEFAULT_ADVANCED, ...agent.advanced },
  };
}

function Section({
  icon,
  title,
  subtitle,
  children,
  action,
}: {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card !p-0">
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <button
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5">{icon}</span>
          <span>
            <span className="block text-sm font-semibold">{title}</span>
            <span className="block text-xs text-ink-400">{subtitle}</span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          {action}
          <button
            onClick={() => setOpen(!open)}
            className="text-ink-400 transition hover:text-ink-100"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? "⌃" : "⌄"}
          </button>
        </div>
      </div>
      {open && <div className="border-t border-ink-700/70 px-6 py-5">{children}</div>}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition ${on ? "grad-bg" : "bg-ink-600"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium">
        {label}: <span className="text-accent-400">{value}{unit}</span>
      </p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-accent-500"
      />
      <p className="mt-1 text-xs text-ink-400">{hint}</p>
    </div>
  );
}

export default function AgentEditor({
  agent,
  agentType,
}: {
  agent: Partial<Agent> & { id?: string };
  agentType: "single_prompt" | "conversation_flow";
}) {
  const router = useRouter();
  const initial = useRef(draftFrom(agent));
  const [draft, setDraft] = useState<Draft>(initial.current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<{ from: "you" | "agent"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial.current),
    [draft]
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setAdv<K extends keyof AgentAdvanced>(key: K, value: AgentAdvanced[K]) {
    setDraft((d) => ({ ...d, advanced: { ...d.advanced, [key]: value } }));
  }

  async function publish() {
    setBusy(true);
    setError(null);
    const systemPrompt = [
      draft.identity && `# Identity\n${draft.identity}`,
      draft.tasks && `# Tasks\n${draft.tasks}`,
      draft.guardrails && `# Style guardrails\n${draft.guardrails}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const payload = {
      ...draft,
      systemPrompt,
      agentType,
      status: draft.status === "draft" ? "active" : draft.status,
    };
    const res = await fetch(agent.id ? `/api/agents/${agent.id}` : "/api/agents", {
      method: agent.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      initial.current = draftFrom(data.agent);
      setDraft(initial.current);
      if (!agent.id) router.replace(`/dashboard/agents/${data.agent.id}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong while publishing.");
    }
    setBusy(false);
  }

  function sendTest() {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    const reply =
      chat.length === 0 && draft.whoSpeaksFirst === "agent"
        ? draft.greeting
        : `(Simulated preview) As ${draft.name}, I'd respond based on your identity and task instructions. Connect a phone number to run live test calls.`;
    setChat((c) => [...c, { from: "you", text }, { from: "agent", text: reply }]);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-5">
        {/* Header */}
        <div className="card flex flex-wrap items-center justify-between gap-3 !py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Link href="/dashboard/agents" className="text-ink-400 hover:text-ink-100">←</Link>
              <h1 className="text-xl font-bold tracking-tight">
                {agent.id ? "Edit Agent" : "New Agent"}
              </h1>
              <span className="badge-muted">v{agent.version ?? 1}</span>
            </div>
            <p className="mt-1 text-xs text-ink-400">
              Modify your AI agent&apos;s behavior, voice settings, and conversation flow.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary !py-2"
              title="Connect a phone number to run live test calls"
              onClick={() =>
                alert("Test calls need a phone number connected via Vapi — see Phone Numbers.")
              }
            >
              📞 Test Call
            </button>
            <button onClick={publish} disabled={busy} className="btn-primary !py-2 disabled:opacity-60">
              {busy ? "Publishing…" : "💾 Publish"}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-4 py-3 text-sm text-signal-red">
            {error}
          </p>
        )}

        {/* Agent Details */}
        <Section icon="👤" title="Agent Details" subtitle="Configure the agent details, voice, and audio settings.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Agent Name</label>
              <input className="field" value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <label className="label">Language</label>
              <select className="field" value={draft.language} onChange={(e) => set("language", e.target.value)}>
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Agent Voice</label>
              <select className="field" value={draft.voice} onChange={(e) => set("voice", e.target.value)}>
                {VOICES.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Background Audio</label>
              <select className="field" value={draft.backgroundAudio} onChange={(e) => set("backgroundAudio", e.target.value)}>
                {BACKGROUND_AUDIO.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* Prompt Configuration OR Flow Designer */}
        {agentType === "single_prompt" ? (
          <Section icon="🎛" title="Prompt Configuration" subtitle="Define the AI's identity, tasks, and style guardrails.">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold">👤 Agent Identity</p>
                <p className="mb-2 text-xs text-ink-400">
                  Describe your agent&apos;s personality, tone, and role — how it presents itself to callers.
                </p>
                <textarea rows={5} className="field font-mono !text-[13px] leading-relaxed"
                  value={draft.identity} onChange={(e) => set("identity", e.target.value)} />
              </div>
              <div>
                <p className="text-sm font-semibold">☑️ Tasks</p>
                <p className="mb-2 text-xs text-ink-400">
                  The specific tasks, goals, or actions the AI should be capable of performing.
                </p>
                <textarea rows={7} className="field font-mono !text-[13px] leading-relaxed"
                  value={draft.tasks} onChange={(e) => set("tasks", e.target.value)} />
              </div>
              <div>
                <p className="text-sm font-semibold">🛡 Style Guardrails</p>
                <p className="mb-2 text-xs text-ink-400">
                  Style guidelines, phrases to use or avoid, and the overall conversational flow.
                </p>
                <textarea rows={6} className="field font-mono !text-[13px] leading-relaxed"
                  value={draft.guardrails} onChange={(e) => set("guardrails", e.target.value)} />
              </div>
            </div>
          </Section>
        ) : (
          <div className="card border-dashed !p-10 text-center">
            <span className="orb mx-auto inline-block h-14 w-14" aria-hidden />
            <h2 className="mt-4 text-lg font-bold">Flow Designer</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-400">
              Design your agent&apos;s conversation flow visually with nodes and
              connections. Create complex dialogue paths with ease.
            </p>
            <button
              className="btn-primary mt-5"
              onClick={() => alert("The visual Flow Designer is the next feature on the roadmap — coming soon.")}
            >
              Open Flow Designer
            </button>
            <p className="mt-3 text-xs text-ink-500">ⓘ Make sure to save your changes before navigating</p>
          </div>
        )}

        {/* Conversation Settings */}
        <Section icon="💬" title="Conversation Settings" subtitle="Configure how the conversation begins and who initiates the dialogue.">
          <div className="space-y-4">
            <div>
              <label className="label">Who speaks first</label>
              <select
                className="field"
                value={draft.whoSpeaksFirst}
                onChange={(e) => set("whoSpeaksFirst", e.target.value as "agent" | "caller")}
              >
                <option value="agent">Agent speaks first — greets the caller immediately</option>
                <option value="caller">Caller speaks first — agent waits and listens</option>
              </select>
            </div>
            <div>
              <label className="label">Opening Message</label>
              <p className="mb-2 text-xs text-ink-400">
                The first thing your agent will say when the call connects. Keep it friendly and professional.
              </p>
              <textarea rows={3} className="field" value={draft.greeting} onChange={(e) => set("greeting", e.target.value)} />
            </div>
          </div>
        </Section>

        {/* Post-Call Data Extraction */}
        <Section
          icon="⟨x⟩"
          title="Post-Call Data Extraction"
          subtitle="Define the information you want to extract from conversations."
          action={
            <button
              onClick={() => set("outcomes", [...draft.outcomes, { name: "", description: "" }])}
              className="btn-secondary !px-3 !py-1.5 !text-xs"
            >
              + Add Manually
            </button>
          }
        >
          {draft.outcomes.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-400">
              No outcomes defined yet — add the fields you want extracted after every call.
            </p>
          ) : (
            <div className="space-y-3">
              {draft.outcomes.map((o, i) => (
                <div key={i} className="flex gap-3">
                  <input
                    className="field w-48"
                    placeholder="field_name"
                    value={o.name}
                    onChange={(e) => {
                      const next = [...draft.outcomes];
                      next[i] = { ...next[i], name: e.target.value };
                      set("outcomes", next);
                    }}
                  />
                  <input
                    className="field flex-1"
                    placeholder="What should the AI extract?"
                    value={o.description}
                    onChange={(e) => {
                      const next = [...draft.outcomes];
                      next[i] = { ...next[i], description: e.target.value };
                      set("outcomes", next);
                    }}
                  />
                  <button
                    onClick={() => set("outcomes", draft.outcomes.filter((_, j) => j !== i))}
                    className="text-ink-400 hover:text-signal-red"
                    aria-label="Remove outcome"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Advanced Settings */}
        <Section icon="⚙️" title="Advanced Settings" subtitle="Configure advanced agent behavior and conversation settings.">
          <div className="space-y-5">
            {/* Agent Speaking */}
            <div className="rounded-xl border border-ink-700 p-5">
              <p className="text-sm font-semibold">🔊 Agent Speaking</p>
              <p className="text-xs text-ink-400">Voice activity detection and turn management.</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <Slider label="Min Speech Duration" unit="s" min={0.1} max={3} step={0.1}
                  value={draft.advanced.minSpeechDuration}
                  hint="Minimum duration for speech to be detected. Shorter values catch quick speech but may trigger on noise."
                  onChange={(v) => setAdv("minSpeechDuration", v)} />
                <Slider label="Min Silence Duration" unit="s" min={0.1} max={3} step={0.1}
                  value={draft.advanced.minSilenceDuration}
                  hint="Minimum silence before the agent responds. Shorter values allow quicker responses but may interrupt."
                  onChange={(v) => setAdv("minSilenceDuration", v)} />
                <Slider label="Activation Threshold" unit="" min={0.1} max={0.9} step={0.1}
                  value={draft.advanced.activationThreshold}
                  hint="Voice-detection sensitivity. Lower = more sensitive (may catch background noise)."
                  onChange={(v) => setAdv("activationThreshold", v)} />
                <Slider label="Prefix Padding" unit="s" min={0.1} max={3} step={0.1}
                  value={draft.advanced.prefixPadding}
                  hint="Audio captured just before detected speech, to avoid cutting off word beginnings."
                  onChange={(v) => setAdv("prefixPadding", v)} />
                <Slider label="End of Speech Timeout" unit="s" min={0} max={3} step={0.1}
                  value={draft.advanced.endOfSpeechTimeout}
                  hint="How long to wait after speech stops before considering it finished. Shorter = faster responses."
                  onChange={(v) => setAdv("endOfSpeechTimeout", v)} />
              </div>
            </div>

            {/* Turn Detection */}
            <div className="rounded-xl border border-ink-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">💬 Turn Detection</p>
                  <p className="text-xs text-ink-400">Automatically detect when it&apos;s the agent&apos;s turn to speak.</p>
                </div>
                <Toggle on={draft.advanced.turnDetection} onChange={(v) => setAdv("turnDetection", v)} />
              </div>
              {draft.advanced.turnDetection && (
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="label">Detection Mode</label>
                    <select className="field" value={draft.advanced.turnDetectionMode}
                      onChange={(e) => setAdv("turnDetectionMode", e.target.value as "smart" | "fixed")}>
                      <option value="smart">Smart — AI-driven turn detection</option>
                      <option value="fixed">Fixed — timeout-based turns</option>
                    </select>
                  </div>
                  <Slider label="Detection Timeout" unit="s" min={0} max={5} step={0.5}
                    value={draft.advanced.turnDetectionTimeout}
                    hint="Max time to wait for a response before the agent takes its turn."
                    onChange={(v) => setAdv("turnDetectionTimeout", v)} />
                </div>
              )}
            </div>

            {/* Noise Reduction */}
            <div className="rounded-xl border border-ink-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">🔉 Noise Reduction</p>
                  <p className="text-xs text-ink-400">Noise reduction and audio enhancement.</p>
                </div>
                <Toggle on={draft.advanced.noiseReduction} onChange={(v) => setAdv("noiseReduction", v)} />
              </div>
              {draft.advanced.noiseReduction && (
                <div className="mt-4">
                  <label className="label">Reduction Level</label>
                  <select className="field sm:max-w-xs" value={draft.advanced.noiseReductionLevel}
                    onChange={(e) => setAdv("noiseReductionLevel", e.target.value as "low" | "medium" | "high")}>
                    <option value="low">Low — light cleanup</option>
                    <option value="medium">Medium — balanced noise reduction</option>
                    <option value="high">High — aggressive filtering</option>
                  </select>
                </div>
              )}
            </div>

            {/* Answering Machine Detection */}
            <div className="rounded-xl border border-ink-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">📞 Answering Machine Detection</p>
                  <p className="text-xs text-ink-400">Detect answering machines and voicemail.</p>
                </div>
                <Toggle on={draft.advanced.amd} onChange={(v) => setAdv("amd", v)} />
              </div>
              {draft.advanced.amd && (
                <div className="mt-4 space-y-4">
                  <label className="flex items-center justify-between rounded-lg border border-ink-700 px-4 py-3 text-sm">
                    <span>
                      <span className="font-medium">Multilingual AMD</span>
                      <span className="block text-xs text-ink-400">Detect answering machines in multiple languages</span>
                    </span>
                    <input type="checkbox" checked={draft.advanced.amdMultilingual}
                      onChange={(e) => setAdv("amdMultilingual", e.target.checked)}
                      className="h-4 w-4 accent-accent-500" />
                  </label>
                  <div>
                    <label className="label">AMD Timeout (seconds)</label>
                    <input type="number" min={10} max={60} className="field sm:max-w-[140px]"
                      value={draft.advanced.amdTimeout}
                      onChange={(e) => setAdv("amdTimeout", Number(e.target.value))} />
                    <p className="mt-1 text-xs text-ink-400">Maximum time (10–60s) to wait for AMD detection.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stop Speaking Plan (Vapi parity) */}
            <div className="rounded-xl border border-ink-700 p-5">
              <p className="text-sm font-semibold">✋ Stop Speaking Plan</p>
              <p className="text-xs text-ink-400">How caller speech interrupts the agent mid-sentence.</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-3">
                <Slider label="Number of Words" unit="" min={0} max={10} step={1}
                  value={draft.advanced.stopSpeakingNumWords}
                  hint="Words the caller must say before the agent stops. 0 = stop on any voice."
                  onChange={(v) => setAdv("stopSpeakingNumWords", v)} />
                <Slider label="Voice Seconds" unit="s" min={0} max={0.5} step={0.1}
                  value={draft.advanced.stopSpeakingVoiceSeconds}
                  hint="Seconds of caller audio that counts as an interruption."
                  onChange={(v) => setAdv("stopSpeakingVoiceSeconds", v)} />
                <Slider label="Back Off Seconds" unit="s" min={0} max={10} step={0.5}
                  value={draft.advanced.stopSpeakingBackoffSeconds}
                  hint="How long the agent waits before speaking again after being interrupted."
                  onChange={(v) => setAdv("stopSpeakingBackoffSeconds", v)} />
              </div>
            </div>

            {/* Messaging (Vapi parity) */}
            <div className="rounded-xl border border-ink-700 p-5">
              <p className="text-sm font-semibold">💬 Call Messages</p>
              <p className="text-xs text-ink-400">What the agent says on voicemail, when idle, and when ending the call.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Voicemail Message</label>
                  <input className="field" value={draft.advanced.voicemailMessage}
                    placeholder="Leave empty to hang up on voicemail"
                    onChange={(e) => setAdv("voicemailMessage", e.target.value)} />
                </div>
                <div>
                  <label className="label">End Call Message</label>
                  <input className="field" value={draft.advanced.endCallMessage}
                    onChange={(e) => setAdv("endCallMessage", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">End Call Phrases</label>
                  <input className="field" value={draft.advanced.endCallPhrases}
                    placeholder="goodbye, bye for now"
                    onChange={(e) => setAdv("endCallPhrases", e.target.value)} />
                  <p className="mt-1 text-xs text-ink-400">Comma-separated. If the caller says one of these, the call ends.</p>
                </div>
                <div>
                  <label className="label">Idle Message</label>
                  <input className="field" value={draft.advanced.idleMessage}
                    onChange={(e) => setAdv("idleMessage", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Idle Timeout (s)</label>
                    <input type="number" min={5} max={60} className="field" value={draft.advanced.idleTimeout}
                      onChange={(e) => setAdv("idleTimeout", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label">Max Idle Messages</label>
                    <input type="number" min={1} max={10} className="field" value={draft.advanced.idleMaxCount}
                      onChange={(e) => setAdv("idleMaxCount", Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Keypad Input (Vapi parity) */}
            <div className="rounded-xl border border-ink-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">🔢 Keypad Input</p>
                  <p className="text-xs text-ink-400">Let callers enter digits (DTMF) — for menus, account numbers, PINs.</p>
                </div>
                <Toggle on={draft.advanced.keypadInputEnabled} onChange={(v) => setAdv("keypadInputEnabled", v)} />
              </div>
              {draft.advanced.keypadInputEnabled && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Timeout (seconds)</label>
                    <input type="number" min={0.5} max={10} step={0.5} className="field"
                      value={draft.advanced.keypadInputTimeout}
                      onChange={(e) => setAdv("keypadInputTimeout", Number(e.target.value))} />
                    <p className="mt-1 text-xs text-ink-400">How long to wait for more digits before submitting.</p>
                  </div>
                  <div>
                    <label className="label">Delimiter</label>
                    <select className="field" value={draft.advanced.keypadInputDelimiter}
                      onChange={(e) => setAdv("keypadInputDelimiter", e.target.value as "#" | "*" | "both")}>
                      <option value="#"># — pound key submits</option>
                      <option value="*">* — star key submits</option>
                      <option value="both"># or * — either submits</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Reminder & Call Duration */}
            <div className="rounded-xl border border-ink-700 p-5">
              <p className="text-sm font-semibold">⏱ Reminder &amp; Call Duration Settings</p>
              <p className="text-xs text-ink-400">How the agent checks on silent callers and call limits.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Silence Before Check (seconds)</label>
                  <input type="number" className="field" value={draft.advanced.silenceBeforeCheck}
                    onChange={(e) => setAdv("silenceBeforeCheck", Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Max Check Attempts</label>
                  <input type="number" className="field" value={draft.advanced.maxCheckAttempts}
                    onChange={(e) => setAdv("maxCheckAttempts", Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Max Silence Duration (seconds)</label>
                  <input type="number" className="field" value={draft.advanced.maxSilenceDuration}
                    onChange={(e) => setAdv("maxSilenceDuration", Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Maximum Call Duration (minutes)</label>
                  <input type="number" className="field" value={draft.advanced.maxCallDuration}
                    onChange={(e) => setAdv("maxCallDuration", Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Privacy */}
            <div className="rounded-xl border border-ink-700 p-5">
              <p className="text-sm font-semibold">🗄 Privacy</p>
              <p className="text-xs text-ink-400">Choose whether to store and analyze call data.</p>
              <select className="field mt-3" value={draft.advanced.dataStorage}
                onChange={(e) => setAdv("dataStorage", e.target.value as "store" | "transcripts_only" | "none")}>
                <option value="store">Store and Analyze Calls — recordings, transcripts and analytics</option>
                <option value="transcripts_only">Transcripts only — no audio recordings stored</option>
                <option value="none">Store nothing — live monitoring only</option>
              </select>
              {draft.advanced.dataStorage === "store" && (
                <div className="mt-3 rounded-lg border border-accent-500/30 bg-accent-500/10 px-4 py-3 text-xs text-ink-200">
                  <p className="font-semibold">Store and Analyze Calls: Enabled</p>
                  <p className="mt-1 text-ink-300">Calls will be stored and analyzed. Available features:</p>
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-ink-300">
                    <li>Call audio recording</li>
                    <li>Call transcripts</li>
                    <li>Post-call outcomes</li>
                    <li>Call summary</li>
                    <li>Sentiment analysis</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Section>
      </div>

      {/* Test Agent rail */}
      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <div className="card flex h-[560px] flex-col !p-0">
          <p className="border-b border-ink-700 px-5 py-3.5 text-sm font-semibold">Test Agent</p>
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {chat.length === 0 ? (
              <p className="pt-16 text-center text-sm text-ink-500">Send a message to test…</p>
            ) : (
              chat.map((m, i) => (
                <div key={i} className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}>
                  <p
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                      m.from === "you" ? "grad-bg text-white" : "bg-ink-800 text-ink-200"
                    }`}
                  >
                    {m.text}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 border-t border-ink-700 p-3">
            <input
              className="field !py-2"
              placeholder="Type a test message…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendTest()}
            />
            <button onClick={sendTest} className="btn-primary !px-4 !py-2">➤</button>
          </div>
        </div>
      </div>

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="fixed bottom-5 left-1/2 z-40 flex w-[min(92vw,560px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-ink-600 bg-ink-900 px-5 py-3 shadow-2xl shadow-black/40">
          <p className="flex items-center gap-2 text-sm text-ink-200">
            <span className="text-signal-amber">⚠️</span> You have unsaved changes
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setDraft(initial.current)} className="btn-secondary !px-4 !py-1.5 !text-xs">
              ↩ Undo Changes
            </button>
            <button onClick={publish} disabled={busy} className="btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-60">
              {busy ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
