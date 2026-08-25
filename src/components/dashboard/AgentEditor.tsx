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
  PhoneOff,
  PhoneForwarded,
  Webhook,
  Mail,
  Calendar,
  Zap,
  Plug,
  User,
  SlidersHorizontal,
  MessageSquare,
  MessagesSquare,
  ListChecks,
  Shield,
  Volume2,
  Volume1,
  Phone,
  Hand,
  Hash,
  Database,
  Save,
  Send,
  AlertTriangle,
  Braces,
  Clock,
  Brain,
  Voicemail,
  MessageSquareText,
  CalendarPlus,
  CalendarSearch,
  Table2,
  MessageCircle,
  Building2,
  Bot,
  Stethoscope,
  RefreshCw,
} from "lucide-react";
import { useEffect } from "react";
import type { Agent, AgentRevision, PhoneNumber } from "@/lib/db";
import type { AgentAdvanced, AgentOutcome, AgentTool } from "@/lib/agent-defaults";
import { DEFAULT_ADVANCED, DEFAULT_TOOLS } from "@/lib/agent-defaults";
import { toast, toastError } from "@/components/Toast";
import { PhoneTestCallModal, WebCallModal } from "@/components/dashboard/TestCallModals";
import {
  SPEED_PRESETS, LLM_OPTIONS, TRANSCRIBER_OPTIONS, VOICE_MODEL_OPTIONS, presetConfig, type SpeedPreset,
} from "@/lib/voice-presets";

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
  speedPreset: SpeedPreset;
  llmModel: string;
  voiceModel: string;
  transcriberModel: string;
};

function draftFrom(agent: Partial<Agent>): Draft {
  // Migrate agents that attached knowledge bases via the old editor section:
  // represent them as a Knowledge Base tool so they show up in Add Tools.
  let tools = agent.tools ?? DEFAULT_TOOLS;
  if (
    agent.knowledgeBaseIds?.length &&
    !tools.some((t) => t.type === "knowledge_base")
  ) {
    tools = [
      ...tools,
      {
        id: "tool_knowledge_base",
        type: "knowledge_base" as const,
        title: "Knowledge Base",
        name: "knowledge_base",
        description: "Look up business knowledge to answer caller questions",
        aiResponse: "Let me look that up for you, one moment.",
        config: { knowledgeBaseIds: agent.knowledgeBaseIds.join(",") },
      },
    ];
  }
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
    tools,
    voiceId: agent.voiceId ?? "",
    knowledgeBaseIds: agent.knowledgeBaseIds ?? [],
    speedPreset: agent.speedPreset ?? "balanced",
    llmModel: agent.llmModel ?? "",
    voiceModel: agent.voiceModel ?? "",
    transcriberModel: agent.transcriberModel ?? "",
  };
}

function Section({
  icon,
  title,
  subtitle,
  children,
  action,
}: {
  icon: React.ReactNode;
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

// Knowledge Base picker: a dropdown (like the voice picker) listing every
// resource with its type; selected ones show as removable name tags.
function KnowledgePicker({
  options,
  selectedIds,
  onChange,
}: {
  options: { id: string; name: string; type: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const available = options.filter((o) => !selectedIds.includes(o.id));
  const selected = selectedIds
    .map((id) => options.find((o) => o.id === id))
    .filter(Boolean) as { id: string; name: string; type: string }[];

  return (
    <div>
      <div ref={wrapRef} className="relative sm:max-w-md">
        <button
          onClick={() => setOpen((v) => !v)}
          className="field flex w-full items-center justify-between text-left"
        >
          <span className="text-ink-400">
            {available.length === 0 ? "All resources attached" : "Select knowledge resources…"}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-400 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && available.length > 0 && (
          <div className="absolute inset-x-0 top-12 z-30 max-h-64 overflow-y-auto rounded-xl border border-ink-700 bg-ink-950 py-1 shadow-xl shadow-black/20">
            {available.map((kb) => (
              <button
                key={kb.id}
                onClick={() => {
                  onChange([...selectedIds, kb.id]);
                  if (available.length === 1) setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm transition hover:bg-ink-800"
              >
                <BookOpen className="h-4 w-4 shrink-0 text-ink-400" />
                <span className="min-w-0 flex-1 truncate font-medium">{kb.name}</span>
                <span className="shrink-0 rounded bg-ink-800 px-2 py-0.5 text-[10px] uppercase text-ink-400">
                  {kb.type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((kb) => (
            <span
              key={kb.id}
              className="flex items-center gap-1.5 rounded-full bg-[#301C3F]/10 py-1.5 pl-3 pr-1.5 text-xs font-medium text-[#301C3F]"
            >
              <BookOpen className="h-3 w-3" />
              {kb.name}
              <span className="rounded bg-white/60 px-1.5 py-0.5 text-[9px] uppercase">{kb.type}</span>
              <button
                onClick={() => onChange(selectedIds.filter((id) => id !== kb.id))}
                aria-label={`Remove ${kb.name}`}
                className="rounded-full p-0.5 text-[#301C3F]/60 transition hover:bg-[#301C3F]/10 hover:text-[#301C3F]"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
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
  const [generateMode, setGenerateMode] = useState<"all" | "tasks" | null>(null);
  const [greetingBusy, setGreetingBusy] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [phoneCallOpen, setPhoneCallOpen] = useState(false);
  const [webCallOpen, setWebCallOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [phoneNums, setPhoneNums] = useState<PhoneNumber[]>([]);

  // Workspace numbers for the phone test-call popup ("Call From").
  useEffect(() => {
    if (!phoneCallOpen || phoneNums.length > 0) return;
    fetch("/api/phone-numbers")
      .then((r) => r.json())
      .then((d) => setPhoneNums(Array.isArray(d.phoneNumbers) ? d.phoneNumbers : []))
      .catch(() => {});
  }, [phoneCallOpen, phoneNums.length]);

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

  async function publish(redirectTo?: "flow") {
    setBusy(true);
    setError(null);
    const systemPrompt = [
      draft.identity && `# Identity\n${draft.identity}`,
      draft.tasks && `# Tasks\n${draft.tasks}`,
      draft.guardrails && `# Style guardrails\n${draft.guardrails}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    // Knowledge bases attach through the Knowledge Base tool (Add Tools);
    // collect the selected resource ids from every knowledge_base tool.
    const knowledgeBaseIds = [
      ...new Set(
        draft.tools
          .filter((t) => t.type === "knowledge_base")
          .flatMap((t) => (t.config?.knowledgeBaseIds ?? "").split(","))
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ];

    const payload = {
      ...draft,
      knowledgeBaseIds,
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
      router.push(redirectTo === "flow" ? `/dashboard/agents/${data.agent.id}/flow` : "/dashboard/agents");
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
          <div className="flex flex-col items-stretch gap-2">
            <div className="flex items-center gap-2">
              {agent.id && (
                <>
                  <button
                    className="btn-secondary !px-3 !py-2"
                    title="Revision history"
                    aria-label="Revision history"
                    onClick={() => setHistoryOpen(true)}
                  >
                    <History className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-secondary !px-3 !py-2"
                    title="Share & embed this agent"
                    aria-label="Share and embed"
                    onClick={() => setShareOpen(true)}
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-secondary !px-3 !py-2"
                    title="Call your phone with this agent"
                    aria-label="Phone test call"
                    onClick={() => setPhoneCallOpen(true)}
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-secondary !px-3 !py-2"
                    title="Diagnostics — check tools & sync"
                    aria-label="Diagnostics"
                    onClick={() => setDiagOpen(true)}
                  >
                    <Stethoscope className="h-4 w-4" />
                  </button>
                  <button
                    className="flex items-center gap-1.5 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-4 py-2 text-sm font-medium text-fuchsia-700 transition hover:bg-fuchsia-100"
                    title="Talk to this agent in the browser"
                    onClick={() => setWebCallOpen(true)}
                  >
                    <Bot className="h-4 w-4" /> Test Call
                  </button>
                </>
              )}
            </div>
            <button onClick={() => publish()} disabled={busy} className="btn-primary !py-2 disabled:opacity-60">
              {busy ? "Publishing…" : (<span className="flex items-center justify-center gap-1.5"><Save className="h-4 w-4" /> Publish</span>)}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-4 py-3 text-sm text-signal-red">
            {error}
          </p>
        )}

        {/* Agent Details */}
        <Section icon={<User className="h-4 w-4 text-ink-400" />} title="Agent Details" subtitle="Configure the agent details, voice, and audio settings.">
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

          {/* Voice engine: one-click preset + individual model overrides. */}
          <div className="mt-5 border-t border-ink-700/60 pt-5">
            <p className="text-sm font-semibold">Intelligence &amp; speed</p>
            <p className="mb-3 text-xs text-ink-400">
              Pick a preset, or fine-tune the brain, voice model and transcriber below. Higher intelligence is smarter; faster/cheaper models cost less per minute.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {SPEED_PRESETS.map((p) => {
                const active = (draft.speedPreset ?? "balanced") === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      const cfg = presetConfig(p.key);
                      setDraft((d) => ({
                        ...d,
                        speedPreset: p.key as SpeedPreset,
                        llmModel: cfg.llm,
                        voiceModel: cfg.voiceModel,
                        transcriberModel: cfg.transcriberModel,
                      }));
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      active ? "border-[#301C3F] bg-[#301C3F]/5" : "border-ink-700 hover:bg-ink-800"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{p.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-400">{p.desc}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Model (brain)</label>
                <select className="field" value={draft.llmModel || presetConfig(draft.speedPreset as SpeedPreset).llm}
                  onChange={(e) => set("llmModel", e.target.value)}>
                  {LLM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Voice model</label>
                <select className="field" value={draft.voiceModel || presetConfig(draft.speedPreset as SpeedPreset).voiceModel}
                  onChange={(e) => set("voiceModel", e.target.value)}>
                  {VOICE_MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Transcriber (ears)</label>
                <select className="field" value={draft.transcriberModel || presetConfig(draft.speedPreset as SpeedPreset).transcriberModel}
                  onChange={(e) => set("transcriberModel", e.target.value)}>
                  {TRANSCRIBER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </Section>

        {/* Prompt Configuration OR Flow Designer */}
        {agentType === "single_prompt" ? (
          <Section
            icon={<SlidersHorizontal className="h-4 w-4 text-ink-400" />}
            title="Prompt Configuration"
            subtitle="Define the AI's identity, tasks, and style guardrails."
            action={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setGenerateMode("all");
                }}
                className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5 !text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate With AI
              </button>
            }
          >
            <div className="space-y-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold"><User className="h-4 w-4 text-ink-400" /> Agent Identity</p>
                <p className="mb-2 text-xs text-ink-400">
                  Describe your agent&apos;s personality, tone, and role — how it presents itself to callers.
                </p>
                <textarea rows={5} className="field font-mono !text-[13px] leading-relaxed"
                  value={draft.identity} onChange={(e) => set("identity", e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4 text-ink-400" /> Tasks</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGenerateMode("tasks")}
                      className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5 !text-xs"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Generate With AI
                    </button>
                    <button
                      onClick={() => setToolsOpen(true)}
                      className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5 !text-xs"
                    >
                      <Wrench className="h-3.5 w-3.5" /> Add Tools
                    </button>
                  </div>
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
                <p className="flex items-center gap-2 text-sm font-semibold"><Shield className="h-4 w-4 text-ink-400" /> Style Guardrails</p>
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
              disabled={busy}
              onClick={() => {
                if (agent.id) router.push(`/dashboard/agents/${agent.id}/flow`);
                else publish("flow"); // save the draft first, then open the designer
              }}
            >
              {agent.id ? "Open Flow Designer" : busy ? "Saving…" : "Save & Open Flow Designer"}
            </button>
            <p className="mt-3 text-xs text-ink-500">ⓘ Make sure to save your changes before navigating</p>
          </div>
        )}

        {/* Conversation Settings */}
        <Section icon={<MessageSquare className="h-4 w-4 text-ink-400" />} title="Conversation Settings" subtitle="Configure how the conversation begins and who initiates the dialogue.">
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
          icon={<Braces className="h-4 w-4 text-ink-400" />}
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
        <Section icon={<Settings className="h-4 w-4 text-ink-400" />} title="Advanced Settings" subtitle="Configure advanced agent behavior and conversation settings.">
          <div className="space-y-5">
            {/* Agent Speaking */}
            <div className="rounded-xl border border-ink-700 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold"><Volume2 className="h-4 w-4 text-ink-400" /> Agent Speaking</p>
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
                  <p className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4 text-ink-400" /> Turn Detection</p>
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
                  <p className="flex items-center gap-2 text-sm font-semibold"><Volume1 className="h-4 w-4 text-ink-400" /> Noise Reduction</p>
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
                  <p className="flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4 text-ink-400" /> Answering Machine Detection</p>
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
              <p className="flex items-center gap-2 text-sm font-semibold"><Hand className="h-4 w-4 text-ink-400" /> Stop Speaking Plan</p>
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
              <p className="flex items-center gap-2 text-sm font-semibold"><MessagesSquare className="h-4 w-4 text-ink-400" /> Call Messages</p>
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
                  <p className="flex items-center gap-2 text-sm font-semibold"><Hash className="h-4 w-4 text-ink-400" /> Keypad Input</p>
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
              <p className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-ink-400" /> Reminder &amp; Call Duration Settings</p>
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
              <p className="flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-ink-400" /> Privacy</p>
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
            <button onClick={sendTest} aria-label="Send" className="btn-primary !px-4 !py-2"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="fixed bottom-5 left-1/2 z-40 flex w-[min(92vw,560px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-ink-600 bg-ink-900 px-5 py-3 shadow-2xl shadow-black/40">
          <p className="flex items-center gap-2 text-sm text-ink-200">
            <AlertTriangle className="h-4 w-4 text-signal-amber" /> You have unsaved changes
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setDraft(initial.current)} className="btn-secondary !px-4 !py-1.5 !text-xs">
              Undo Changes
            </button>
            <button onClick={() => publish()} disabled={busy} className="btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-60">
              {busy ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      )}

      {generateMode && (
        <GenerateWizard
          mode={generateMode}
          onClose={() => setGenerateMode(null)}
          onGenerated={(g) => {
            setGenerateMode(null);
            setDraft((d) => ({
              ...d,
              identity: g.identity || d.identity,
              tasks: g.tasks || d.tasks,
              guardrails: g.guardrails || d.guardrails,
              greeting: g.greeting || d.greeting,
            }));
            toast(generateMode === "tasks" ? "Tasks generated." : "Prompt sections generated.");
          }}
        />
      )}
      {toolsOpen && (
        <ManageToolsModal
          tools={draft.tools}
          knowledgeBases={knowledgeBases}
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
      {webCallOpen && agent.id && (
        <WebCallModal agent={{ ...(agent as Agent), name: draft.name }} onClose={() => setWebCallOpen(false)} />
      )}
      {phoneCallOpen && agent.id && (
        <PhoneTestCallModal
          agent={{ ...(agent as Agent), name: draft.name }}
          phoneNumbers={phoneNums}
          onClose={() => setPhoneCallOpen(false)}
        />
      )}
      {diagOpen && agent.id && (
        <VapiDiagnosticsModal agentId={agent.id} onClose={() => setDiagOpen(false)} />
      )}
    </div>
  );
}

// --- Generate Prompt Sections: step-by-step wizard --------------------------
// Instead of one free-text box, the wizard asks structured questions so the
// blueprint can be filled properly. Optional steps can be skipped; whatever
// is answered flows into the generated prompt.

const WIZARD_STEPS = [
  { title: "Business", subtitle: "What is this agent for?" },
  { title: "Your Agent", subtitle: "Who is the agent?" },
  { title: "Team", subtitle: "Staff & services (optional)" },
  { title: "Details", subtitle: "Hours, contact, policies (optional)" },
] as const;

interface WizardAnswers {
  businessName: string;
  businessDescription: string;
  agentName: string;
  agentRole: string;
  team: string;
  services: string;
  hours: string;
  location: string;
  contact: string;
  policies: string;
  extra: string;
}

const EMPTY_ANSWERS: WizardAnswers = {
  businessName: "",
  businessDescription: "",
  agentName: "",
  agentRole: "Inbound receptionist",
  team: "",
  services: "",
  hours: "",
  location: "",
  contact: "",
  policies: "",
  extra: "",
};

function GenerateWizard({
  mode,
  onClose,
  onGenerated,
}: {
  mode: "all" | "tasks";
  onClose: () => void;
  onGenerated: (g: { identity: string; tasks: string; guardrails: string; greeting: string }) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>(EMPTY_ANSWERS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setA<K extends keyof WizardAnswers>(key: K, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  const canNext =
    step !== 0 || (answers.businessName.trim().length > 1 && answers.businessDescription.trim().length > 9);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: mode, answers }),
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
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-ink-700 bg-ink-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <h2 className="text-lg font-bold">
              {mode === "tasks" ? "Generate Tasks" : "Generate Prompt Sections"}
            </h2>
            <p className="mt-0.5 text-sm text-ink-400">
              Answer a few quick questions — the more you share, the more precise the prompt.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step circles */}
        <div className="flex items-center gap-0 px-6 pt-5">
          {WIZARD_STEPS.map((s, i) => (
            <div key={s.title} className={`flex items-center ${i > 0 ? "flex-1" : ""}`}>
              {i > 0 && (
                <span className={`mx-1.5 h-px flex-1 ${i <= step ? "bg-[#301C3F]" : "bg-ink-700"}`} />
              )}
              <button
                onClick={() => i < step && setStep(i)}
                className="flex flex-col items-center gap-1"
                title={s.subtitle}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                    i < step
                      ? "bg-[#301C3F] text-white"
                      : i === step
                        ? "border-2 border-[#301C3F] text-[#301C3F]"
                        : "border border-ink-700 text-ink-400"
                  }`}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={`text-[10px] ${i === step ? "font-semibold text-ink-100" : "text-ink-400"}`}>
                  {s.title}
                </span>
              </button>
            </div>
          ))}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <>
              <div>
                <label className="label">Business name *</label>
                <input className="field" placeholder="e.g. Bright Smile Dental Clinic"
                  value={answers.businessName} onChange={(e) => setA("businessName", e.target.value)} />
              </div>
              <div>
                <label className="label">What does the business do? *</label>
                <textarea rows={5} className="field"
                  placeholder="Describe the business and what the agent should handle — e.g. 'A dental clinic in Dubai. The agent answers calls, books appointments with our doctors, answers questions about treatments, and transfers complex cases to the front desk.'"
                  value={answers.businessDescription} onChange={(e) => setA("businessDescription", e.target.value)} />
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <div>
                <label className="label">Agent name</label>
                <input className="field" placeholder="e.g. Sarah (leave empty to let AI pick one)"
                  value={answers.agentName} onChange={(e) => setA("agentName", e.target.value)} />
              </div>
              <div>
                <label className="label">What kind of agent is it?</label>
                <select className="field" value={answers.agentRole} onChange={(e) => setA("agentRole", e.target.value)}>
                  <option>Inbound receptionist</option>
                  <option>Outbound re-engagement caller</option>
                  <option>Outbound sales agent</option>
                  <option>Customer support agent</option>
                  <option>Appointment scheduler</option>
                  <option>Lead qualification agent</option>
                </select>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div>
                <label className="label">Team / staff <span className="text-ink-500">(optional)</span></label>
                <textarea rows={5} className="field"
                  placeholder={"Who works there, their specialties and schedules — e.g.\nDr. Smith — general dentistry, Mon–Fri\nDr. Lee — orthodontics, Tue & Thu\nOr for a garage: 'Mike — best mechanic for German cars'"}
                  value={answers.team} onChange={(e) => setA("team", e.target.value)} />
              </div>
              <div>
                <label className="label">Services offered <span className="text-ink-500">(optional)</span></label>
                <textarea rows={3} className="field"
                  placeholder="e.g. Cleanings, whitening, implants, braces, emergency visits"
                  value={answers.services} onChange={(e) => setA("services", e.target.value)} />
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Working hours <span className="text-ink-500">(optional)</span></label>
                  <input className="field" placeholder="e.g. Mon–Sat 9 AM – 6 PM"
                    value={answers.hours} onChange={(e) => setA("hours", e.target.value)} />
                </div>
                <div>
                  <label className="label">Location <span className="text-ink-500">(optional)</span></label>
                  <input className="field" placeholder="e.g. Al Wasl Road, Dubai"
                    value={answers.location} onChange={(e) => setA("location", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Contact details <span className="text-ink-500">(optional)</span></label>
                <input className="field" placeholder="Phone, WhatsApp, email, website"
                  value={answers.contact} onChange={(e) => setA("contact", e.target.value)} />
              </div>
              <div>
                <label className="label">Policies <span className="text-ink-500">(optional)</span></label>
                <textarea rows={2} className="field"
                  placeholder="e.g. Never quote prices; 24h cancellation notice; insurance is pay-and-claim"
                  value={answers.policies} onChange={(e) => setA("policies", e.target.value)} />
              </div>
              <div>
                <label className="label">Anything else? <span className="text-ink-500">(optional)</span></label>
                <textarea rows={2} className="field"
                  placeholder="Any other rules, offers, or details the agent should know"
                  value={answers.extra} onChange={(e) => setA("extra", e.target.value)} />
              </div>
            </>
          )}
          {error && <p className="text-sm text-signal-red">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-ink-700 px-6 py-4">
          <button
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            className="btn-secondary"
          >
            {step === 0 ? "Cancel" : "← Back"}
          </button>
          <div className="flex items-center gap-2">
            {step >= 2 && step < WIZARD_STEPS.length - 1 && (
              <button onClick={() => setStep(step + 1)} className="text-sm text-ink-400 hover:text-ink-200">
                Skip
              </button>
            )}
            {step < WIZARD_STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext}
                className="btn-primary disabled:opacity-50"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={generate}
                disabled={busy}
                className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" /> {busy ? "Generating…" : "Generate"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Manage Agent Tools (Callab parity) -------------------------------------

// The Add Tool gallery: every tool type the agent can be given, each opening
// its own type-specific settings form.
const TOOL_GALLERY: {
  type: NonNullable<AgentTool["type"]>;
  title: string;
  icon: typeof PhoneOff;
  blurb: string;
  defaults: Omit<AgentTool, "id">;
}[] = [
  {
    type: "end_call",
    title: "End Call",
    icon: PhoneOff,
    blurb: "Ends the phone call when the conversation is complete",
    defaults: {
      type: "end_call",
      title: "End Call",
      name: "end_call",
      description: "Ends the phone call when the conversation is complete",
      aiResponse: "Say goodbye and wish the caller a great day.",
    },
  },
  {
    type: "transfer_call",
    title: "Transfer Call",
    icon: PhoneForwarded,
    blurb: "Transfer the caller to another department or phone number",
    defaults: {
      type: "transfer_call",
      title: "Transfer Call",
      name: "transfer_call",
      description: "Transfer the caller to another department or phone number",
      aiResponse: "Let me transfer you to the right department. Please hold on.",
      config: { transferType: "Twilio", phoneNumber: "" },
    },
  },
  {
    type: "live_webhook",
    title: "Live Webhook",
    icon: Webhook,
    blurb: "Send data to an external API endpoint during the call",
    defaults: {
      type: "live_webhook",
      title: "Live Webhook",
      name: "live_webhook",
      description: "Send data to an external API endpoint during the call",
      aiResponse: "One moment while I process that for you.",
      config: {
        method: "POST",
        serverUrl: "",
        httpHeaders: '{\n  "Content-Type": "application/json"\n}',
        body: '{\n  "caller_name": "{{caller_name}}"\n}',
      },
    },
  },
  {
    type: "send_email",
    title: "Send Email",
    icon: Mail,
    blurb: "Send an email to the caller",
    defaults: {
      type: "send_email",
      title: "Send Email",
      name: "send_email",
      description: "Send an email to the caller",
      aiResponse: "Let me send you an email with the information you requested.",
      config: {
        emailSubject: "Follow-up from our call",
        emailContent:
          "Hi {{caller_name}},\n\nThank you for calling us today. Here is the information we discussed:\n\n{{call_summary}}\n\nBest regards",
      },
    },
  },
  {
    type: "cal_com",
    title: "Cal.com",
    icon: Calendar,
    blurb: "Schedule a meeting with the caller",
    defaults: {
      type: "cal_com",
      title: "Cal.com",
      name: "cal_com",
      description: "Schedule a meeting with the caller through Cal.com",
      aiResponse: "Let me check the calendar and schedule that for you.",
      config: { calApiKey: "", calEventTypeId: "" },
    },
  },
  {
    type: "zapier",
    title: "Zapier",
    icon: Zap,
    blurb: "Send data to Zapier webhook",
    defaults: {
      type: "zapier",
      title: "Zapier Webhook",
      name: "zapier_webhook",
      description: "Send data to Zapier webhook",
      aiResponse: "Let me process that information through our system.",
      config: {
        zapierUrl: "",
        fields: JSON.stringify([
          { name: "caller_name", description: "Name of the caller" },
          { name: "caller_phone", description: "Phone number of the caller" },
          { name: "call_summary", description: "Summary of the call" },
          { name: "timestamp", description: "Call timestamp" },
        ]),
      },
    },
  },
  {
    type: "knowledge_base",
    title: "Knowledge Base",
    icon: BookOpen,
    blurb: "Give the agent access to a knowledge base for reference during conversations",
    defaults: {
      type: "knowledge_base",
      title: "Knowledge Base",
      name: "knowledge_base",
      description: "Look up business knowledge to answer caller questions",
      aiResponse: "Let me look that up for you, one moment.",
      config: { knowledgeBaseIds: "" },
    },
  },
  {
    type: "mcp",
    title: "MCP",
    icon: Plug,
    blurb: "Connect to Model Context Protocol servers to extend agent capabilities with external tools and data sources",
    defaults: {
      type: "mcp",
      title: "MCP Server",
      name: "mcp_server",
      description: "Connect to Model Context Protocol server to extend agent capabilities",
      aiResponse: "Let me connect to the MCP server to access additional tools and data.",
      config: {
        serverUrl: "https://your-mcp-server.com",
        httpHeaders: '{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer YOUR_TOKEN"\n}',
      },
    },
  },
  {
    type: "customer_memory",
    title: "Customer Memory",
    icon: Brain,
    blurb: "Recognise returning customers and remember new ones — reads and writes your Contacts and call history",
    defaults: {
      type: "customer_memory",
      title: "Customer Memory",
      name: "customer_memory",
      description:
        "Look up whether a caller is an existing customer (name, email, last visit, notes) and save new caller details for next time",
      aiResponse: "Let me check our records for you, one moment.",
    },
  },
  {
    type: "voicemail",
    title: "Leave Voicemail",
    icon: Voicemail,
    blurb: "Leave a voice message when the call reaches an answering machine",
    defaults: {
      type: "voicemail",
      title: "Leave Voicemail",
      name: "leave_voicemail",
      description: "Leaves a voice message when voicemail is detected",
      aiResponse: "Leave a brief, friendly message with a callback number.",
    },
  },
  {
    type: "dtmf",
    title: "DTMF Keypad",
    icon: Hash,
    blurb: "Press keypad digits during the call — for navigating phone menus and IVRs",
    defaults: {
      type: "dtmf",
      title: "DTMF Keypad",
      name: "press_keypad",
      description: "Presses keypad digits (DTMF tones) during the call",
      aiResponse: "One moment while I enter that.",
    },
  },
  {
    type: "sms",
    title: "Send Message",
    icon: MessageSquareText,
    blurb: "Send an SMS text message to the caller during or after the call",
    defaults: {
      type: "sms",
      title: "Send Message",
      name: "send_message",
      description: "Sends an SMS text message to the caller",
      aiResponse: "I've just sent that to your phone.",
    },
  },
  {
    type: "gcal_create",
    title: "Google Calendar — Create",
    icon: CalendarPlus,
    blurb: "Create an event on a connected Google Calendar",
    defaults: {
      type: "gcal_create",
      title: "Google Calendar — Create Event",
      name: "gcal_create_event",
      description: "Creates a calendar event for the caller's booking",
      aiResponse: "Let me put that on the calendar for you.",
    },
  },
  {
    type: "gcal_availability",
    title: "Google Calendar — Availability",
    icon: CalendarSearch,
    blurb: "Check available time slots on a connected Google Calendar",
    defaults: {
      type: "gcal_availability",
      title: "Google Calendar — Check Availability",
      name: "gcal_check_availability",
      description: "Checks the calendar for available time slots",
      aiResponse: "Let me check the calendar for open times.",
    },
  },
  {
    type: "gsheets",
    title: "Google Sheets",
    icon: Table2,
    blurb: "Append call data as a new row in a connected Google Sheet",
    defaults: {
      type: "gsheets",
      title: "Google Sheets",
      name: "gsheets_add_row",
      description: "Appends a row with call data to a Google Sheet",
      aiResponse: "One moment while I record that.",
    },
  },
  {
    type: "slack",
    title: "Slack",
    icon: MessageCircle,
    blurb: "Send a message to a connected Slack channel",
    defaults: {
      type: "slack",
      title: "Slack",
      name: "slack_send_message",
      description: "Sends a notification message to the team's Slack channel",
      aiResponse: "I'm notifying the team right now.",
    },
  },
  {
    type: "ghl",
    title: "GoHighLevel",
    icon: Building2,
    blurb: "Create or update a contact in a connected GoHighLevel account",
    defaults: {
      type: "ghl",
      title: "GoHighLevel",
      name: "ghl_create_contact",
      description: "Creates a contact in GoHighLevel with the caller's details",
      aiResponse: "Let me save your details in our system.",
    },
  },
  {
    type: "custom",
    title: "Custom Tool",
    icon: Wrench,
    blurb: "Define your own tool with a server URL and custom properties the agent collects",
    defaults: {
      type: "custom",
      title: "Custom Tool",
      name: "custom_tool",
      description: "Describe here exactly what this tool does and when the agent should use it",
      aiResponse: "One moment while I take care of that.",
      config: {
        serverUrl: "",
        httpHeaders: '{\n  "Content-Type": "application/json"\n}',
        properties: JSON.stringify([{ name: "input", type: "string", description: "The value to send", required: true }]),
      },
    },
  },
];

const PROVIDER_TOOL_NOTE: Partial<Record<NonNullable<AgentTool["type"]>, string>> = {
  sms: "SMS sending uses the phone provider linked to your account (e.g. Twilio).",
  gcal_create: "Connect Google Calendar in Integrations for this tool to activate.",
  gcal_availability: "Connect Google Calendar in Integrations for this tool to activate.",
  gsheets: "Connect Google Sheets in Integrations for this tool to activate.",
  slack: "Connect Slack in Integrations for this tool to activate.",
  ghl: "Connect GoHighLevel in Integrations for this tool to activate.",
};

function ManageToolsModal({
  tools,
  knowledgeBases,
  onChange,
  onClose,
}: {
  tools: AgentTool[];
  knowledgeBases: KnowledgeOption[];
  onChange: (tools: AgentTool[]) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<AgentTool | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [adding, setAdding] = useState<(typeof TOOL_GALLERY)[number] | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
          <button onClick={() => setGalleryOpen(true)} className="btn-secondary flex items-center gap-1.5 !text-sm">
            <Plus className="h-3.5 w-3.5" /> Add Tool
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {tools.length === 0 && (
            <p className="rounded-xl border border-ink-700 px-4 py-8 text-center text-sm text-ink-400">
              No tools yet — add one to give your agent capabilities like ending the call.
            </p>
          )}
          {tools.map((t) => {
            const typeLabel = TOOL_GALLERY.find((g) => g.type === t.type)?.title ?? "Custom";
            const urlLine =
              t.type === "live_webhook"
                ? `${t.config?.method ?? "POST"} ${t.config?.serverUrl ?? ""}`
                : t.type === "zapier"
                  ? `POST ${t.config?.zapierUrl ?? ""}`
                  : t.type === "mcp"
                    ? `MCP ${t.config?.serverUrl ?? ""}`
                    : null;
            return (
            <div key={t.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-700 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {t.title}
                  <span className="rounded-full bg-[#301C3F]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#301C3F]">
                    {typeLabel}
                  </span>
                </p>
                <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-ink-400">{t.description}</p>
                {urlLine && urlLine.trim().length > 5 && (
                  <p className="mt-1 truncate font-mono text-[11px] text-ink-500">{urlLine}</p>
                )}
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
            );
          })}
        </div>

        {galleryOpen && (
          <ToolGalleryModal
            onClose={() => setGalleryOpen(false)}
            onPick={(entry) => {
              setGalleryOpen(false);
              setAdding(entry);
            }}
          />
        )}

        {(editing || adding) && (
          <EditToolModal
            tool={editing ?? undefined}
            typeEntry={
              adding ??
              TOOL_GALLERY.find((g) => g.type === (editing?.type ?? "custom"))
            }
            knowledgeBases={knowledgeBases}
            onClose={() => {
              setEditing(null);
              setAdding(null);
            }}
            onSave={(tool) => {
              onChange(
                editing
                  ? tools.map((x) => (x.id === tool.id ? tool : x))
                  : [...tools, tool]
              );
              setEditing(null);
              setAdding(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Repeater for a custom tool's properties (name, type, description, required).
function PropertiesEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  let props: { name: string; type: string; description: string; required: boolean }[] = [];
  try {
    props = JSON.parse(value);
    if (!Array.isArray(props)) props = [];
  } catch {
    props = [];
  }
  const update = (next: typeof props) => onChange(JSON.stringify(next));

  return (
    <div className="space-y-2.5">
      {props.map((p, i) => (
        <div key={i} className="rounded-xl border border-ink-700 p-3">
          <div className="flex gap-2">
            <input
              className="field flex-1 !py-2 font-mono !text-[13px]"
              placeholder="property_name"
              value={p.name}
              onChange={(e) =>
                update(props.map((x, j) => (j === i ? { ...x, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") } : x)))
              }
            />
            <select
              className="field w-28 !py-2 !text-[13px]"
              value={p.type}
              onChange={(e) => update(props.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
            </select>
            <button
              onClick={() => update(props.filter((_, j) => j !== i))}
              aria-label="Remove property"
              className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              className="field flex-1 !py-2 !text-[13px]"
              placeholder="What this property contains"
              value={p.description}
              onChange={(e) => update(props.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
            />
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-300">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-accent-500"
                checked={p.required}
                onChange={(e) => update(props.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))}
              />
              Required
            </label>
          </div>
        </div>
      ))}
      <button
        onClick={() => update([...props, { name: "", type: "string", description: "", required: false }])}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-600 py-2.5 text-sm text-ink-400 transition hover:border-[#301C3F]/50 hover:text-ink-200"
      >
        <Plus className="h-3.5 w-3.5" /> Add Property
      </button>
    </div>
  );
}

// Repeater for the Zapier tool's data fields (name + description each).
function ZapierFieldsEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  let fields: { name: string; description: string }[] = [];
  try {
    fields = JSON.parse(value);
    if (!Array.isArray(fields)) fields = [];
  } catch {
    fields = [];
  }

  function update(next: { name: string; description: string }[]) {
    onChange(JSON.stringify(next));
  }

  return (
    <div className="space-y-2.5">
      {fields.map((f, i) => (
        <div key={i} className="flex gap-2 rounded-xl border border-ink-700 p-3">
          <div className="flex-1 space-y-2">
            <input
              className="field !py-2 font-mono !text-[13px]"
              placeholder="field_name"
              value={f.name}
              onChange={(e) =>
                update(fields.map((x, j) => (j === i ? { ...x, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") } : x)))
              }
            />
            <textarea
              rows={2}
              className="field !py-2 !text-[13px]"
              placeholder="What this field contains"
              value={f.description}
              onChange={(e) => update(fields.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
            />
          </div>
          <button
            onClick={() => update(fields.filter((_, j) => j !== i))}
            aria-label="Remove field"
            className="self-start rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...fields, { name: "", description: "" }])}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-600 py-2.5 text-sm text-ink-400 transition hover:border-[#301C3F]/50 hover:text-ink-200"
      >
        <Plus className="h-3.5 w-3.5" /> Add Field
      </button>
    </div>
  );
}

// The Callab-style tool gallery — pick a tool type, then configure it.
function ToolGalleryModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (entry: (typeof TOOL_GALLERY)[number]) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Add Tool</h2>
            <p className="mt-0.5 text-sm text-ink-400">
              Choose a tool to enhance your agent&apos;s capabilities during conversations
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOL_GALLERY.map((entry) => (
            <button
              key={entry.type}
              onClick={() => onPick(entry)}
              className="card card-hover flex flex-col items-center gap-2.5 !p-6 text-center"
            >
              <entry.icon className="h-6 w-6 text-ink-300" />
              <span className="text-sm font-semibold">{entry.title}</span>
              <span className="text-xs leading-relaxed text-ink-400">{entry.blurb}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditToolModal({
  tool,
  typeEntry,
  knowledgeBases,
  onClose,
  onSave,
}: {
  tool?: AgentTool;
  typeEntry?: (typeof TOOL_GALLERY)[number];
  knowledgeBases: KnowledgeOption[];
  onClose: () => void;
  onSave: (tool: AgentTool) => void;
}) {
  const defaults = tool ?? typeEntry?.defaults;
  const toolType = tool?.type ?? typeEntry?.type ?? "custom";
  const [title, setTitle] = useState(defaults?.title ?? "");
  const [name, setName] = useState(defaults?.name ?? "");
  const [description, setDescription] = useState(defaults?.description ?? "");
  const [aiResponse, setAiResponse] = useState(defaults?.aiResponse ?? "");
  const [config, setConfig] = useState<Record<string, string>>({ ...(defaults?.config ?? {}) });

  function setC(key: string, value: string) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  const kbSelected = (config.knowledgeBaseIds ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{tool ? "Edit Tool" : "Add New Tool"}</h2>
            <p className="mt-0.5 text-sm text-ink-400">
              {tool ? "Modify the tool settings." : "Define a tool that the AI agent can use during conversations."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label">Tool Title</label>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Tool Name (ID)</label>
            <input
              className="field bg-ink-800/50 font-mono !text-[13px]"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={2} className="field" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">AI Response</label>
            <textarea rows={2} className="field" value={aiResponse} onChange={(e) => setAiResponse(e.target.value)} />
            <p className="mt-1 text-xs text-ink-400">What the agent should say when it uses this tool.</p>
          </div>

          {/* Type-specific settings */}
          {toolType === "transfer_call" && (
            <>
              <div>
                <label className="label">Transfer Type</label>
                <select className="field" value={config.transferType ?? "Twilio"} onChange={(e) => setC("transferType", e.target.value)}>
                  <option>Twilio</option>
                  <option>SIP</option>
                  <option>Direct dial</option>
                </select>
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input className="field font-mono !text-[13px]" placeholder="+1234567890"
                  value={config.phoneNumber ?? ""} onChange={(e) => setC("phoneNumber", e.target.value)} />
                <p className="mt-1 text-xs text-ink-400">Enter phone number in E.164 format (e.g., +14155552671)</p>
              </div>
            </>
          )}

          {toolType === "live_webhook" && (
            <>
              <div>
                <label className="label">Method</label>
                <select className="field" value={config.method ?? "POST"} onChange={(e) => setC("method", e.target.value)}>
                  <option>POST</option>
                  <option>GET</option>
                </select>
              </div>
              <div>
                <label className="label">URL</label>
                <input className="field font-mono !text-[13px]" placeholder="https://api.example.com/endpoint"
                  value={config.serverUrl ?? ""} onChange={(e) => setC("serverUrl", e.target.value)} />
              </div>
              <div>
                <label className="label">Headers</label>
                <textarea rows={3} className="field font-mono !text-[12px]"
                  value={config.httpHeaders ?? ""} onChange={(e) => setC("httpHeaders", e.target.value)} />
              </div>
              <div>
                <label className="label">Body</label>
                <textarea rows={5} className="field font-mono !text-[12px]"
                  value={config.body ?? ""} onChange={(e) => setC("body", e.target.value)} />
                <p className="mt-1 text-xs text-ink-400">
                  Every {"{{variable}}"} becomes a parameter the agent collects during the call and sends.
                </p>
              </div>
            </>
          )}

          {toolType === "mcp" && (
            <>
              <div>
                <label className="label">Server URL</label>
                <input className="field font-mono !text-[13px]" placeholder="https://your-mcp-server.com"
                  value={config.serverUrl ?? ""} onChange={(e) => setC("serverUrl", e.target.value)} />
              </div>
              <div>
                <label className="label">HTTP Headers</label>
                <textarea rows={4} className="field font-mono !text-[12px]"
                  value={config.httpHeaders ?? ""} onChange={(e) => setC("httpHeaders", e.target.value)} />
              </div>
              <p className="rounded-lg border border-ink-700 bg-ink-800/60 px-3.5 py-2.5 text-xs text-ink-300">
                MCP servers are not provided or verified by us. It is the client&apos;s/developer&apos;s
                responsibility to ensure the security and reliability of the MCP server.
              </p>
            </>
          )}

          {toolType === "send_email" && (
            <>
              <div>
                <label className="label">Email Subject</label>
                <input className="field" value={config.emailSubject ?? ""} onChange={(e) => setC("emailSubject", e.target.value)} />
              </div>
              <div>
                <label className="label">Email Content</label>
                <textarea rows={5} className="field !text-[13px]"
                  value={config.emailContent ?? ""} onChange={(e) => setC("emailContent", e.target.value)} />
                <p className="mt-1 text-xs text-ink-400">
                  Use {"{{caller_name}}"} and {"{{call_summary}}"} — they fill in from the call.
                </p>
              </div>
            </>
          )}

          {toolType === "cal_com" && (
            <>
              <div>
                <label className="label">Cal.com API Key</label>
                <input className="field font-mono !text-[13px]" placeholder="cal_live_…"
                  value={config.calApiKey ?? ""} onChange={(e) => setC("calApiKey", e.target.value)} />
              </div>
              <div>
                <label className="label">Event Type ID</label>
                <input className="field font-mono !text-[13px]" placeholder="e.g. 1234567"
                  value={config.calEventTypeId ?? ""} onChange={(e) => setC("calEventTypeId", e.target.value)} />
                <p className="mt-1 text-xs text-ink-400">Found in your Cal.com event type&apos;s URL.</p>
              </div>
            </>
          )}

          {toolType === "zapier" && (
            <>
              <div>
                <label className="label">Zapier Webhook URL</label>
                <input className="field font-mono !text-[13px]" placeholder="https://hooks.zapier.com/hooks/catch/…"
                  value={config.zapierUrl ?? ""} onChange={(e) => setC("zapierUrl", e.target.value)} />
                <p className="mt-1 text-xs text-ink-400">Your Zapier webhook URL from your Zap.</p>
              </div>
              <div>
                <label className="label">Fields</label>
                <p className="mb-2 text-xs text-ink-400">Define the data fields to send to Zapier.</p>
                <ZapierFieldsEditor
                  value={config.fields ?? "[]"}
                  onChange={(v) => setC("fields", v)}
                />
              </div>
            </>
          )}

          {toolType === "custom" && (
            <>
              <div>
                <label className="label">Server URL</label>
                <input className="field font-mono !text-[13px]" placeholder="https://api.example.com/tool"
                  value={config.serverUrl ?? ""} onChange={(e) => setC("serverUrl", e.target.value)} />
                <p className="mt-1 text-xs text-ink-400">
                  When the agent uses this tool, the collected properties are POSTed here.
                </p>
              </div>
              <div>
                <label className="label">HTTP Headers</label>
                <textarea rows={3} className="field font-mono !text-[12px]"
                  value={config.httpHeaders ?? ""} onChange={(e) => setC("httpHeaders", e.target.value)} />
              </div>
              <div>
                <label className="label">Properties</label>
                <p className="mb-2 text-xs text-ink-400">
                  The values the agent collects from the caller and sends to your server.
                </p>
                <PropertiesEditor value={config.properties ?? "[]"} onChange={(v) => setC("properties", v)} />
              </div>
            </>
          )}

          {toolType === "customer_memory" && (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
              Works out of the box — no setup needed. The agent can ask &quot;are you an existing
              patient/customer?&quot;, look the caller up by name or phone in your Contacts (with their
              email, notes, and last visit from Call Logs), and save new callers so they&apos;re
              recognised next time.
            </p>
          )}

          {PROVIDER_TOOL_NOTE[toolType] && (
            <p className="rounded-lg border border-ink-700 bg-ink-800/60 px-3.5 py-2.5 text-xs text-ink-300">
              {PROVIDER_TOOL_NOTE[toolType]}
            </p>
          )}

          {toolType === "knowledge_base" && (
            <div>
              <label className="label">Knowledge Bases</label>
              {knowledgeBases.length === 0 ? (
                <p className="rounded-lg border border-ink-700 px-3.5 py-3 text-sm text-ink-400">
                  No resources yet — add files, text, or URLs under Knowledge Bases first.
                </p>
              ) : (
                <KnowledgePicker
                  options={knowledgeBases}
                  selectedIds={kbSelected}
                  onChange={(ids) => setC("knowledgeBaseIds", ids.join(","))}
                />
              )}
              <p className="mt-1.5 text-xs text-ink-400">
                Select one or more resources — the agent reads their content and answers from it.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={() =>
                onSave({
                  id: tool?.id ?? `tool_${Math.random().toString(36).slice(2, 10)}`,
                  type: toolType,
                  title,
                  name,
                  description,
                  aiResponse,
                  config,
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
                The widget connects to this agent, so callers talk to the
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

// --- Vapi Diagnostics -------------------------------------------------------
// Shows exactly what Vapi has for this agent: is it synced, which tools
// actually attached vs. which we expect, the precise rejection reason if any,
// and whether the site URL + phone numbers are wired up. This turns "it
// doesn't work" into a concrete, fixable answer.

function VapiDiagnosticsModal({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const [data, setData] = useState<{
    vapiConfigured: boolean;
    hint?: string;
    siteUrl: string | null;
    siteUrlOk: boolean;
    numbers: { number: string; provider: string; agent: string; linkedInApp: boolean; presentInVapi: boolean; inboundReady?: boolean }[];
    vapiNumberCount: number;
    agentReport: {
      name: string;
      synced: boolean;
      expectedTools: string[];
      vapiTools: string[];
      missingTools: string[];
      toolSyncError: string | null;
      skippedTools?: string[];
      knowledge?: {
        attachedResources: { name: string; chars: number }[];
        builtChars: number;
        livePromptChars: number | null;
        liveHasKnowledgeSection: boolean;
        liveHasDocumentStart: boolean;
        liveHasDocumentEnd: boolean;
        verdict: string;
      };
    } | null;
  } | null>(null);
  const [busy, setBusy] = useState(true);

  const load = async () => {
    setBusy(true);
    const res = await fetch(`/api/vapi/diagnostics?agentId=${agentId}`);
    setData(await res.json().catch(() => null));
    setBusy(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const report = data?.agentReport;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Stethoscope className="h-5 w-5 text-[#301C3F]" /> Diagnostics</h2>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={busy} aria-label="Re-check" className="btn-secondary !px-2.5 !py-2 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {busy && !data ? (
          <p className="py-10 text-center text-sm text-ink-400">Re-syncing this agent and reading it back…</p>
        ) : !data ? (
          <p className="py-10 text-center text-sm text-signal-red">Could not run diagnostics.</p>
        ) : (
          <div className="mt-5 space-y-4 text-sm">
            <Row label="Calling system key (server)" ok={data.vapiConfigured}
              value={data.vapiConfigured ? "Set" : "Missing — set the calling-system key in Netlify"} />
            <Row label="Site URL (for tool callbacks)" ok={data.siteUrlOk}
              value={data.siteUrl ?? "Missing — set SITE_URL in Netlify"} />

            {report && (
              <>
                <Row label="Agent synced" ok={report.synced} value={report.synced ? "Yes" : "No"} />

                {/* Knowledge: is it attached, indexed, and LIVE on the assistant? */}
                {report.knowledge && (
                  <div className={`rounded-lg border px-3 py-2.5 ${
                    report.knowledge.verdict.startsWith("OK")
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-signal-red/40 bg-signal-red/10"
                  }`}>
                    <p className={`text-xs font-semibold ${report.knowledge.verdict.startsWith("OK") ? "text-emerald-800" : "text-signal-red"}`}>
                      Knowledge check
                    </p>
                    <p className={`mt-1 break-words text-xs ${report.knowledge.verdict.startsWith("OK") ? "text-emerald-800" : "text-signal-red"}`}>
                      {report.knowledge.verdict}
                    </p>
                    <div className="mt-2 space-y-0.5 text-[11px] text-ink-400">
                      {report.knowledge.attachedResources.map((r) => (
                        <p key={r.name}>• {r.name} — {r.chars.toLocaleString()} chars indexed</p>
                      ))}
                      <p>
                        Built for prompt: {report.knowledge.builtChars.toLocaleString()} chars
                        {report.knowledge.livePromptChars !== null && ` · live prompt on the voice system: ${report.knowledge.livePromptChars.toLocaleString()} chars`}
                        {` · document end present: ${report.knowledge.liveHasDocumentEnd ? "yes" : "NO"}`}
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <p className="mb-1.5 font-semibold">Active tools ({report.vapiTools.length})</p>
                  {report.vapiTools.length === 0 ? (
                    <p className="rounded-lg bg-ink-800 px-3 py-2 text-xs text-ink-300">No tools attached to this agent.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {report.vapiTools.map((t) => (
                        <code key={t} className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{t}</code>
                      ))}
                    </div>
                  )}
                </div>
                {report.missingTools.length > 0 && (
                  <div>
                    <p className="mb-1.5 font-semibold text-amber-600">Expected but missing ({report.missingTools.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {report.missingTools.map((t) => (
                        <code key={t} className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{t}</code>
                      ))}
                    </div>
                  </div>
                )}
                {report.skippedTools && report.skippedTools.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-amber-800">Tools skipped (placeholder URLs)</p>
                    <p className="mt-1 break-words text-xs text-amber-800">
                      These point at example.com and were skipped so they can&apos;t fail calls:{" "}
                      <span className="font-semibold">{report.skippedTools.join(", ")}</span>. Give each a real https
                      URL, or delete them — the built-in booking below already saves to your Calendar &amp; Contacts.
                    </p>
                  </div>
                )}
                {report.toolSyncError && !report.skippedTools?.length && (
                  <div className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3 py-2.5">
                    <p className="text-xs font-semibold text-signal-red">Why tools didn&apos;t attach</p>
                    <p className="mt-1 break-words text-xs text-signal-red">{report.toolSyncError}</p>
                  </div>
                )}
              </>
            )}

            <div>
              <p className="mb-1.5 font-semibold">Phone numbers ({data.vapiNumberCount} in system)</p>
              {data.numbers.length === 0 ? (
                <p className="rounded-lg bg-ink-800 px-3 py-2 text-xs text-ink-300">No numbers added in the app yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.numbers.map((n, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-ink-700 px-3 py-2 text-xs">
                      <span className="font-mono">{n.number} <span className="text-ink-400">· {n.agent}</span></span>
                      <span className="flex items-center gap-2">
                        <span className={n.presentInVapi ? "text-emerald-600" : "text-signal-red"}>{n.presentInVapi ? "in system" : "not in system"}</span>
                        <span className={n.inboundReady ? "text-emerald-600" : "text-signal-red"} title="Whether the number has an agent assigned — required for inbound calls to be answered">
                          {n.inboundReady ? "answers calls" : "no agent in system"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="rounded-lg bg-ink-800 px-3 py-2 text-xs text-ink-300">
              For an inbound call to be answered, the number must show both &ldquo;in system&rdquo; and &ldquo;answers
              calls&rdquo;. If it says &ldquo;no agent in system&rdquo;, re-assign the agent in Phone Numbers → three-dots →
              Assign agent. After changing Netlify env vars, click re-check above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-800 pb-2">
      <span className="text-ink-300">{label}</span>
      <span className={`flex items-center gap-1.5 text-right font-medium ${ok ? "text-emerald-600" : "text-signal-red"}`}>
        {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        <span className="max-w-[240px] truncate" title={value}>{value}</span>
      </span>
    </div>
  );
}
