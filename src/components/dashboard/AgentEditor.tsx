"use client";

// Full agent editor: details, prompt configuration (or flow designer),
// conversation settings, post-call data extraction, advanced settings,
// plus a Test Agent side panel, publish button, and unsaved-changes bar.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Wrench,
  History,
  Share2,
  X,
  Plus,
  Trash2,
  Globe,
  Lock,
  Copy,
  Check,
  Settings,
  ChevronDown,
  Play,
  Square,
  BookOpen,
} from "lucide-react";
import { useEffect } from "react";
import type { Agent, AgentRevision } from "@/lib/db";
import type { AgentAdvanced, AgentOutcome, AgentTool } from "@/lib/agent-defaults";
import { DEFAULT_ADVANCED, DEFAULT_TOOLS } from "@/lib/agent-defaults";
import { toast, toastError } from "@/components/Toast";

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
  tools: AgentTool[];
  voiceId: string;
  knowledgeBaseIds: string[];
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
    tools: agent.tools ?? DEFAULT_TOOLS,
    voiceId: agent.voiceId ?? "",
    knowledgeBaseIds: agent.knowledgeBaseIds ?? [],
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

interface KnowledgeOption {
  id: string;
  name: string;
  type: string;
}

interface VoiceOption {
  voiceId: string;
  name: string;
  labels: string;
  previewUrl: string | null;
}

// Voice picker with live ElevenLabs previews: every voice on the account is
// listed (via /api/voices) with a play button that speaks a sample.
function VoicePicker({
  voice,
  voiceId,
  onSelect,
}: {
  voice: string;
  voiceId: string;
  onSelect: (name: string, id: string) => void;
}) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((d) => {
        setVoices(d.voices ?? []);
        setLive(Boolean(d.live));
      })
      .catch(() => {});
    return () => audioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function preview(v: VoiceOption) {
    if (!v.previewUrl) return;
    if (playingId === v.voiceId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(v.previewUrl);
    audioRef.current = audio;
    setPlayingId(v.voiceId);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
  }

  const selected = voices.find((v) => v.voiceId === voiceId);
  const q = query.trim().toLowerCase();
  const visible = voices.filter(
    (v) => !q || `${v.name} ${v.labels}`.toLowerCase().includes(q)
  );

  return (
    <div ref={wrapRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="field flex w-full items-center justify-between text-left">
        <span className="truncate">{selected?.name ?? voice ?? "Pick a voice"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-12 z-30 overflow-hidden rounded-xl border border-ink-700 bg-ink-950 shadow-xl shadow-black/20">
          {voices.length > 8 && (
            <input
              className="w-full border-b border-ink-700 bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-500"
              placeholder="Search voices..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className="max-h-72 overflow-y-auto py-1">
            {visible.map((v) => (
              <div
                key={v.voiceId}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-ink-800 ${
                  v.voiceId === voiceId ? "bg-ink-800/60" : ""
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    preview(v);
                  }}
                  disabled={!v.previewUrl}
                  title={v.previewUrl ? "Preview voice" : "No preview available"}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink-700 text-ink-300 transition hover:border-[#301C3F] hover:text-[#301C3F] disabled:opacity-40"
                >
                  {playingId === v.voiceId ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => {
                    onSelect(v.name, v.voiceId);
                    setOpen(false);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate font-medium">{v.name}</span>
                  {v.labels && <span className="block truncate text-xs text-ink-400">{v.labels}</span>}
                </button>
                {v.voiceId === voiceId && <Check className="h-4 w-4 shrink-0 text-[#301C3F]" />}
              </div>
            ))}
            {visible.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-ink-400">No voices match.</p>
            )}
          </div>
          {!live && (
            <p className="border-t border-ink-700 px-3.5 py-2 text-[11px] text-amber-700">
              Add ELEVENLABS_API_KEY to list every ElevenLabs voice with audio previews.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentEditor({
  agent,
  agentType,
  knowledgeBases = [],
}: {
  agent: Partial<Agent> & { id?: string };
  agentType: "single_prompt" | "conversation_flow";
  knowledgeBases?: KnowledgeOption[];
}) {
  const router = useRouter();
  const initial = useRef(draftFrom(agent));
  const [draft, setDraft] = useState<Draft>(initial.current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<{ from: "you" | "agent"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [greetingBusy, setGreetingBusy] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

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
      // Sync local state FIRST so the unsaved-changes bar doesn't reappear,
      // then return to the agents list where the (new) agent is visible.
      initial.current = draftFrom(data.agent);
      setDraft(initial.current);
      toast(agent.id ? `Agent "${data.agent.name}" updated.` : `Agent "${data.agent.name}" created.`);
      router.push("/dashboard/agents");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Something went wrong while publishing.");
    toastError(data.error ?? "Publishing failed — check the editor for details.");
    setBusy(false);
  }

  async function generateGreeting() {
    setGreetingBusy(true);
    try {
      const description =
        draft.identity.trim() ||
        `An AI voice agent named ${draft.name} working as: ${agent.role ?? "a general assistant"}.`;
      const res = await fetch("/api/ai/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, section: "greeting" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      if (data.greeting) {
        set("greeting", data.greeting);
        toast("Opening message generated.");
      }
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setGreetingBusy(false);
    }
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
            {agent.id && (
              <>
                <button
                  className="btn-secondary flex items-center gap-1.5 !py-2"
                  title="Revision history"
                  onClick={() => setHistoryOpen(true)}
                >
                  <History className="h-4 w-4" /> History
                </button>
                <button
                  className="btn-secondary flex items-center gap-1.5 !py-2"
                  title="Share & embed this agent"
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </>
            )}
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
              <VoicePicker
                voice={draft.voice}
                voiceId={draft.voiceId}
                onSelect={(name, id) => setDraft((d) => ({ ...d, voice: name, voiceId: id }))}
              />
            </div>
            <div>
              <label className="label">Background Audio</label>
              <select className="field" value={draft.backgroundAudio} onChange={(e) => set("backgroundAudio", e.target.value)}>
                {BACKGROUND_AUDIO.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* Knowledge Base */}
        <Section
          icon="📚"
          title="Knowledge Base"
          subtitle="Attach knowledge resources — the agent reads them and answers from their content."
        >
          {knowledgeBases.length === 0 ? (
            <p className="py-3 text-sm text-ink-400">
              No resources yet — add files, text, or URLs under{" "}
              <Link href="/dashboard/knowledge" className="text-accent-600 hover:text-accent-500">
                Knowledge Bases
              </Link>{" "}
              and they&apos;ll be selectable here.
            </p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {knowledgeBases.map((kb) => {
                  const checked = draft.knowledgeBaseIds.includes(kb.id);
                  return (
                    <label
                      key={kb.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                        checked ? "border-[#301C3F] bg-[#301C3F]/5" : "border-ink-700 hover:bg-ink-800/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-accent-500"
                        checked={checked}
                        onChange={() =>
                          set(
                            "knowledgeBaseIds",
                            checked
                              ? draft.knowledgeBaseIds.filter((id) => id !== kb.id)
                              : [...draft.knowledgeBaseIds, kb.id]
                          )
                        }
                      />
                      <BookOpen className="h-4 w-4 shrink-0 text-ink-400" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{kb.name}</span>
                        <span className="block text-xs uppercase text-ink-400">{kb.type}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-ink-400">
                {draft.knowledgeBaseIds.length === 0
                  ? "Select the resources this agent should know — clinic info, FAQs, price lists, anything."
                  : `${draft.knowledgeBaseIds.length} resource${draft.knowledgeBaseIds.length === 1 ? "" : "s"} attached. Their content is loaded fresh on every publish and test, so editing a resource updates the agent automatically.`}
              </p>
            </>
          )}
        </Section>

        {/* Prompt Configuration OR Flow Designer */}
        {agentType === "single_prompt" ? (
          <Section
            icon="🎛"
            title="Prompt Configuration"
            subtitle="Define the AI's identity, tasks, and style guardrails."
            action={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setGenerateOpen(true);
                }}
                className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5 !text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate With AI
              </button>
            }
          >
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
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">☑️ Tasks</p>
                  <button
                    onClick={() => setToolsOpen(true)}
                    className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5 !text-xs"
                  >
                    <Wrench className="h-3.5 w-3.5" /> Add Tools
                  </button>
                </div>
                <p className="mb-2 text-xs text-ink-400">
                  The specific tasks, goals, or actions the AI should be capable of performing.
                </p>
                <textarea rows={7} className="field font-mono !text-[13px] leading-relaxed"
                  value={draft.tasks} onChange={(e) => set("tasks", e.target.value)} />
                {draft.tools.length > 0 && (
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
                    Enabled Tools:
                    {draft.tools.map((t) => (
                      <code key={t.id} className="rounded bg-ink-800 px-2 py-0.5 text-accent-300">
                        {t.name}
                      </code>
                    ))}
                  </p>
                )}
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
              <div className="flex items-center justify-between">
                <label className="label !mb-0">Opening Message</label>
                <button
                  onClick={generateGreeting}
                  disabled={greetingBusy}
                  className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5 !text-xs disabled:opacity-50"
                  title="Write an opening line from the agent's identity"
                >
                  <Sparkles className="h-3.5 w-3.5" /> {greetingBusy ? "Writing…" : "Generate With AI"}
                </button>
              </div>
              <p className="mb-2 mt-1 text-xs text-ink-400">
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
                <div key={i} className="rounded-xl border border-ink-700 p-4">
                  <div className="flex gap-3">
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
                      className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red"
                      aria-label="Remove outcome"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-medium text-ink-400">Possible Values (optional)</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {(o.possibleValues ?? []).map((v, vi) => (
                        <span
                          key={vi}
                          className="flex items-center gap-1 rounded-full bg-[#301C3F]/10 px-2.5 py-1 text-xs font-medium text-[#301C3F]"
                        >
                          {v}
                          <button
                            onClick={() => {
                              const next = [...draft.outcomes];
                              next[i] = {
                                ...next[i],
                                possibleValues: (next[i].possibleValues ?? []).filter((_, j) => j !== vi),
                              };
                              set("outcomes", next);
                            }}
                            aria-label={`Remove ${v}`}
                            className="text-[#301C3F]/60 hover:text-[#301C3F]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        className="field !w-40 !px-2.5 !py-1 !text-xs"
                        placeholder="Add value ⏎"
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          const value = e.currentTarget.value.trim();
                          if (!value) return;
                          const next = [...draft.outcomes];
                          next[i] = {
                            ...next[i],
                            possibleValues: [...(next[i].possibleValues ?? []), value],
                          };
                          set("outcomes", next);
                          e.currentTarget.value = "";
                        }}
                      />
                    </div>
                  </div>
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

      {generateOpen && (
        <GeneratePromptModal
          onClose={() => setGenerateOpen(false)}
          onGenerated={(g) => {
            setGenerateOpen(false);
            setDraft((d) => ({
              ...d,
              identity: g.identity || d.identity,
              tasks: g.tasks || d.tasks,
              guardrails: g.guardrails || d.guardrails,
              greeting: g.greeting || d.greeting,
            }));
          }}
        />
      )}
      {toolsOpen && (
        <ManageToolsModal
          tools={draft.tools}
          onChange={(tools) => set("tools", tools)}
          onClose={() => setToolsOpen(false)}
        />
      )}
      {historyOpen && agent.id && (
        <RevisionsPanel
          currentVersion={agent.version ?? 1}
          revisions={agent.revisions ?? []}
          onRestore={(snapshot) => {
            setHistoryOpen(false);
            setDraft(draftFrom({ ...agent, ...snapshot } as Partial<Agent>));
          }}
          onClose={() => setHistoryOpen(false)}
        />
      )}
      {shareOpen && agent.id && (
        <ShareAgentModal
          agentId={agent.id}
          initialVisibility={agent.visibility ?? "private"}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

// --- Generate Prompt Sections (Callab parity) -------------------------------

function GeneratePromptModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (g: { identity: string; tasks: string; guardrails: string; greeting: string }) => void;
}) {
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      onGenerated(data);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Generate Prompt Sections</h2>
            <p className="mt-0.5 text-sm text-ink-400">Describe what kind of prompt you want to generate or change…</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea
          rows={5}
          className="field mt-4"
          placeholder="e.g., 'Create a friendly customer support agent for a clothing store that can handle returns and answer questions about sizing.'"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-signal-red">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={generate}
            disabled={busy || description.trim().length < 10}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> {busy ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Manage Agent Tools (Callab parity) -------------------------------------

function ManageToolsModal({
  tools,
  onChange,
  onClose,
}: {
  tools: AgentTool[];
  onChange: (tools: AgentTool[]) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<AgentTool | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Manage Agent Tools</h2>
            <p className="mt-0.5 text-sm text-ink-400">
              Add and configure tools to enhance your agent&apos;s capabilities during conversations.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={() => setAdding(true)} className="btn-secondary flex items-center gap-1.5 !text-sm">
            <Plus className="h-3.5 w-3.5" /> Add Tool
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {tools.length === 0 && (
            <p className="rounded-xl border border-ink-700 px-4 py-8 text-center text-sm text-ink-400">
              No tools yet — add one to give your agent capabilities like ending the call.
            </p>
          )}
          {tools.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-700 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {t.title}
                  <code className="rounded bg-[#301C3F]/10 px-2 py-0.5 text-[11px] font-medium text-[#301C3F]">{t.name}</code>
                </p>
                <p className="truncate text-xs text-ink-400">{t.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setEditing(t)}
                  title="Tool settings"
                  className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onChange(tools.filter((x) => x.id !== t.id))}
                  title="Remove tool"
                  className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {(editing || adding) && (
          <EditToolModal
            tool={editing ?? undefined}
            onClose={() => {
              setEditing(null);
              setAdding(false);
            }}
            onSave={(tool) => {
              onChange(
                editing
                  ? tools.map((x) => (x.id === tool.id ? tool : x))
                  : [...tools, tool]
              );
              setEditing(null);
              setAdding(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

function EditToolModal({
  tool,
  onClose,
  onSave,
}: {
  tool?: AgentTool;
  onClose: () => void;
  onSave: (tool: AgentTool) => void;
}) {
  const [title, setTitle] = useState(tool?.title ?? "");
  const [name, setName] = useState(tool?.name ?? "");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [aiResponse, setAiResponse] = useState(tool?.aiResponse ?? "");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{tool ? "Edit Tool" : "Add Tool"}</h2>
            <p className="mt-0.5 text-sm text-ink-400">
              {tool ? "Modify the tool settings." : "Define a new capability for your agent."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label">Tool Title</label>
            <input className="field" placeholder="End Call" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Tool Name (ID)</label>
            <input
              className="field font-mono !text-[13px]"
              placeholder="end_call"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={3} className="field" placeholder="Allows the AI agent to end the current call"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">AI Response</label>
            <textarea rows={3} className="field" placeholder="Say goodbye and wish the caller a great day."
              value={aiResponse} onChange={(e) => setAiResponse(e.target.value)} />
            <p className="mt-1 text-xs text-ink-400">What the agent should say when it uses this tool.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={() =>
                onSave({
                  id: tool?.id ?? `tool_${Math.random().toString(36).slice(2, 10)}`,
                  title,
                  name,
                  description,
                  aiResponse,
                })
              }
              disabled={!title.trim() || !name.trim()}
              className="btn-primary disabled:opacity-50"
            >
              {tool ? "Update" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Revision history (Callab parity) ---------------------------------------

function RevisionsPanel({
  currentVersion,
  revisions,
  onRestore,
  onClose,
}: {
  currentVersion: number;
  revisions: AgentRevision[];
  onRestore: (snapshot: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-sm flex-col border-l border-ink-700 bg-ink-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-ink-400" /> Revision History
            </h2>
            <p className="text-xs text-ink-400">Restore any previously published version</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-[#301C3F]/40 bg-[#301C3F]/5 px-4 py-3">
            <p className="text-sm font-semibold">v{currentVersion} — Current</p>
            <p className="text-xs text-ink-400">This is the live published version.</p>
          </div>
          {revisions.length === 0 && (
            <p className="px-1 py-6 text-center text-sm text-ink-400">
              No previous revisions yet — publish a change to start the history.
            </p>
          )}
          {revisions.map((r) => (
            <div key={`${r.version}-${r.savedAt}`} className="rounded-xl border border-ink-700 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">v{r.version}</p>
                <button
                  onClick={() => onRestore(r.snapshot)}
                  className="btn-secondary !px-3 !py-1 !text-xs"
                >
                  Restore
                </button>
              </div>
              <p className="mt-0.5 text-xs text-ink-400">
                Updated {new Date(r.savedAt).toLocaleString()}
              </p>
              {typeof r.snapshot.identity === "string" && r.snapshot.identity && (
                <p className="mt-1.5 line-clamp-2 text-xs text-ink-500">{r.snapshot.identity as string}</p>
              )}
            </div>
          ))}
        </div>
        <p className="border-t border-ink-700 px-5 py-3 text-xs text-ink-500">
          Restoring loads that version into the editor — hit Publish to make it live.
        </p>
      </div>
    </div>
  );
}

// --- Share & embed (Callab parity) ------------------------------------------

function ShareAgentModal({
  agentId,
  initialVisibility,
  onClose,
}: {
  agentId: string;
  initialVisibility: "private" | "public";
  onClose: () => void;
}) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedUrl = `${origin}/embed/${agentId}`;
  const embedCode = `<iframe\n  src="${embedUrl}"\n  width="340"\n  height="260"\n  style="border:none;border-radius:16px"\n  allow="microphone"\n></iframe>`;

  async function setPublic(next: "private" | "public") {
    setBusy(true);
    const res = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: next }),
    });
    if (res.ok) setVisibility(next);
    setBusy(false);
  }

  async function copy(text: string, which: string) {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Share2 className="h-4 w-4 text-ink-400" /> Share Agent
            </h2>
            <p className="mt-0.5 text-sm text-ink-400">
              Make this agent public and embed a web-call widget on any website.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Visibility */}
        <div className="mt-5 flex items-center justify-between rounded-xl border border-ink-700 px-4 py-3.5">
          <div className="flex items-center gap-3">
            {visibility === "public" ? (
              <Globe className="h-5 w-5 text-emerald-600" />
            ) : (
              <Lock className="h-5 w-5 text-ink-400" />
            )}
            <div>
              <p className="text-sm font-semibold">Agent visibility</p>
              <p className="text-xs text-ink-400">
                {visibility === "public"
                  ? "Public — anyone with the link or embed can talk to this agent."
                  : "Private — only your workspace can access this agent."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPublic(visibility === "public" ? "private" : "public")}
            disabled={busy}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${
              visibility === "public"
                ? "bg-ink-800 text-ink-200 hover:bg-ink-700"
                : "bg-[#301C3F] text-white hover:opacity-90"
            }`}
          >
            {busy ? "…" : visibility === "public" ? "Make private" : "Make public"}
          </button>
        </div>

        {visibility === "public" ? (
          <>
            <div className="mt-4">
              <p className="text-xs font-medium text-ink-400">Share link</p>
              <div className="mt-1.5 flex gap-2">
                <input readOnly className="field font-mono !text-[12px]" value={embedUrl} />
                <button onClick={() => copy(embedUrl, "link")} className="btn-secondary flex items-center gap-1.5 !px-3">
                  {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-ink-400">Embed code — paste into any website</p>
              <div className="relative mt-1.5">
                <pre className="overflow-x-auto rounded-xl bg-[#0D1526] p-4 font-mono text-[12px] leading-relaxed text-emerald-300">
                  {embedCode}
                </pre>
                <button
                  onClick={() => copy(embedCode, "embed")}
                  className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white transition hover:bg-white/20"
                >
                  {copied === "embed" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "embed" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                The widget uses your VAPI_PUBLIC_KEY and this agent&apos;s Vapi assistant, so callers talk to the
                real model straight from the browser.
              </p>
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-xl border border-ink-700 px-4 py-6 text-center text-sm text-ink-400">
            Make the agent public to get a share link and embed code.
          </p>
        )}
      </div>
    </div>
  );
}
