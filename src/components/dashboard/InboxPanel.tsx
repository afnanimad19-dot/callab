"use client";

// Omnichannel Inbox: WhatsApp / Instagram / Messenger conversations in one
// place. Left: conversation list with channel filter + unread badges.
// Middle: the thread with a composer (text, voice notes on WhatsApp, and an
// on-demand AI reply). Right: customer details. The top bar switches a
// conversation between the AI agent (Agent Hub) and a human operator, and
// lets you override which agent handles this conversation.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle, Camera, MessagesSquare, Search, RefreshCw, Send, Mic, Square,
  Bot, User, Sparkles, SlidersHorizontal, ChevronDown, ExternalLink, Pencil,
  Plus, Trash2, ArrowUp, ArrowDown, X, Lock, Smile, FileText, Braces, Paperclip, AtSign,
} from "lucide-react";
import Link from "next/link";
import type { Agent, ChatMessage, Contact, Conversation } from "@/lib/db";
import { DEFAULT_STAGES, STAGE_COLOR_KEYS, colorOf, type LifecycleStage } from "@/lib/lifecycle";
import { toast, toastError } from "@/components/Toast";

const CHANNEL_META = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, cls: "bg-emerald-100 text-emerald-700" },
  instagram: { label: "Instagram", icon: Camera, cls: "bg-pink-100 text-pink-700" },
  messenger: { label: "Messenger", icon: MessagesSquare, cls: "bg-blue-100 text-blue-700" },
} as const;

// Composer helpers: quick emoji, canned snippets, and insertable variables.
const EMOJIS = ["👍","🙏","😊","🎉","✅","📅","📞","💬","❤️","😀","🙌","👋","🤝","⏰","📍","✨","🙂","👌","🔔","📝"];
const SNIPPETS = [
  "Thanks for reaching out! How can we help you today?",
  "We're open Saturday to Thursday, 9am–9pm.",
  "Could you please share your preferred date and time?",
  "Your appointment is confirmed — we look forward to seeing you!",
  "Could I have your full name and phone number, please?",
];
const VARIABLES = [
  { token: "{{name}}", label: "Customer name" },
  { token: "{{date}}", label: "Today's date" },
];

// A conversation's stage key (falls back to the first configured stage).
function convStage(c: Conversation, stages: LifecycleStage[]): string {
  return c.lifecycle || stages[0]?.key || "new_lead";
}
function findStage(key: string, stages: LifecycleStage[]): LifecycleStage {
  return stages.find((s) => s.key === key) ?? stages[0] ?? DEFAULT_STAGES[0];
}

export default function InboxPanel({ agents }: { agents: Agent[] }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState<"all" | "whatsapp" | "instagram" | "messenger">("all");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [stages, setStages] = useState<LifecycleStage[]>(DEFAULT_STAGES);
  const [editStages, setEditStages] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"reply" | "comment">("reply");
  const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [tool, setTool] = useState<null | "emoji" | "snippets" | "vars" | "mention">(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    setAtBottom(true);
  }
  function onThreadScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/inbox");
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.conversations)) setConversations(data.conversations);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const res = await fetch(`/api/inbox/${id}`);
    const data = await res.json().catch(() => ({}));
    if (data.conversation) {
      setActive(data.conversation);
      setMessages(data.messages ?? []);
      setContact(data.contact ?? null);
    }
  }, []);

  const loadStages = useCallback(async () => {
    const res = await fetch("/api/inbox/stages");
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.stages) && data.stages.length) setStages(data.stages);
  }, []);

  useEffect(() => { loadConversations(); loadStages(); }, [loadConversations, loadStages]);
  useEffect(() => {
    fetch("/api/settings/users").then((r) => r.json()).then((d) => setMembers(d.members ?? [])).catch(() => {});
  }, []);
  useEffect(() => { if (activeId) loadThread(activeId); }, [activeId, loadThread]);
  // Light polling keeps the thread live while the tab is open.
  useEffect(() => {
    const t = setInterval(() => {
      loadConversations();
      if (activeId) loadThread(activeId);
    }, 12000);
    return () => clearInterval(t);
  }, [activeId, loadConversations, loadThread]);
  // Auto-jump to the newest message only if the reader is already near the
  // bottom, so it doesn't yank them away while they scroll history.
  useEffect(() => {
    if (atBottom) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);
  // Switching conversation always lands at the latest message.
  useEffect(() => {
    if (activeId) requestAnimationFrame(() => scrollToBottom());
  }, [activeId, active?.id]);

  const visible = conversations
    .filter((c) => filter === "all" || c.channel === filter)
    .filter((c) => stageFilter === "all" || convStage(c, stages) === stageFilter)
    .filter((c) => !unreadOnly || c.unread > 0)
    .filter((c) => {
      const q = query.trim().toLowerCase();
      return !q || `${c.customerName} ${c.customerPhone ?? ""} ${c.lastMessageText ?? ""}`.toLowerCase().includes(q);
    });

  const stageCount = (key: string) => conversations.filter((c) => convStage(c, stages) === key).length;
  const unreadCount = conversations.filter((c) => c.unread > 0).length;

  function insert(t: string) {
    setText((prev) => (prev && !prev.endsWith(" ") ? prev + " " : prev) + t + " ");
    setTool(null);
  }
  function substituteVars(s: string) {
    return s
      .replaceAll("{{name}}", active?.customerName ?? "there")
      .replaceAll("{{date}}", new Date().toLocaleDateString());
  }

  async function send() {
    const raw = text.trim();
    if (!raw || !active || busy) return;
    const isComment = mode === "comment";
    setBusy(true);
    setText("");
    setTool(null);
    const res = await fetch(`/api/inbox/${active.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isComment ? { comment: true, text: raw } : { text: substituteVars(raw) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMessages((m) => [...m, data.message]);
      if (!isComment && data.delivered === false) toastError("Saved, but the channel didn't accept the message — check Settings → Channels.");
      loadConversations();
    } else {
      toastError(data.error ?? "Could not send the message.");
    }
  }

  async function aiReply() {
    if (!active || busy) return;
    setBusy(true);
    const res = await fetch(`/api/inbox/${active.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai: true }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMessages((m) => [...m, data.message]);
      loadConversations();
    } else {
      toastError(data.error ?? "Could not generate an AI reply.");
    }
  }

  async function patchConversation(patch: Record<string, unknown>) {
    if (!active) return;
    const res = await fetch(`/api/inbox/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.conversation) {
      setActive(data.conversation);
      if (data.contact !== undefined) setContact(data.contact);
      loadConversations();
    }
  }

  async function toggleRecord() {
    if (!active || active.channel !== "whatsapp") {
      toastError("Voice notes are supported on WhatsApp conversations.");
      return;
    }
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
          reader.readAsDataURL(blob);
        });
        const res = await fetch(`/api/inbox/${active.id}/audio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64, mimeType: "audio/webm" }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setMessages((m) => [...m, data.message]);
          toast("Voice note sent.");
        } else {
          toastError(data.error ?? "Could not send the voice note.");
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toastError("Microphone access is needed to record a voice note.");
    }
  }

  function pickFile() {
    if (!active) return;
    if (active.channel !== "whatsapp") {
      toastError("File attachments are supported on WhatsApp conversations.");
      return;
    }
    setTool(null);
    fileInputRef.current?.click();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !active) return;
    if (file.size > 5 * 1024 * 1024) {
      toastError("Please attach a file under 5 MB.");
      return;
    }
    setBusy(true);
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.readAsDataURL(file);
    });
    const res = await fetch(`/api/inbox/${active.id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: base64, mimeType: file.type || "application/octet-stream", filename: file.name }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMessages((m) => [...m, data.message]);
      toast("File sent.");
      loadConversations();
    } else {
      toastError(data.error ?? "Could not send the file.");
    }
  }

  const agentName = (id?: string) =>
    agents.find((a) => a.id === id)?.name ?? "Default agent";

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="mt-0.5 text-sm text-ink-400">
            WhatsApp, Instagram and Messenger conversations — answered by your agents or by you
          </p>
        </div>
        <Link href="/dashboard/settings" className="btn-secondary flex items-center gap-1.5 !text-sm">
          <SlidersHorizontal className="h-4 w-4" /> Channel settings
        </Link>
      </div>

      <div className="card grid min-h-0 flex-1 grid-cols-1 overflow-hidden !p-0 lg:grid-cols-[172px_288px_1fr_268px]">
        {/* Lifecycle rail */}
        <div className="hidden min-h-0 flex-col border-r border-ink-700 lg:flex">
          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            <button
              onClick={() => { setStageFilter("all"); setUnreadOnly(false); }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                stageFilter === "all" && !unreadOnly ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:bg-ink-900"
              }`}>
              <span>All</span>
              <span className="text-xs text-ink-500">{conversations.length}</span>
            </button>
            <button
              onClick={() => { setUnreadOnly((u) => !u); setStageFilter("all"); }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                unreadOnly ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:bg-ink-900"
              }`}>
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">{unreadCount}</span>
              )}
            </button>
            <div className="flex items-center justify-between px-2.5 pb-1 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Lifecycle</p>
              <button onClick={() => setEditStages(true)} title="Edit stages" className="rounded p-0.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200">
                <Pencil className="h-3 w-3" />
              </button>
            </div>
            {stages.map((s) => (
              <button key={s.key}
                onClick={() => { setStageFilter(s.key); setUnreadOnly(false); }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                  stageFilter === s.key ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:bg-ink-900"
                }`}>
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${colorOf(s.color).dot}`} />
                  {s.label}
                </span>
                <span className="text-xs text-ink-500">{stageCount(s.key)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex min-h-0 flex-col border-r border-ink-700">
          <div className="space-y-2 border-b border-ink-700 p-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"><Search className="h-3.5 w-3.5" /></span>
              <input className="field !py-2 !pl-9 !text-sm" placeholder="Search conversations..."
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-1">
              {(["all", "whatsapp", "instagram", "messenger"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                    filter === f ? "bg-[#301C3F] text-white" : "bg-ink-800 text-ink-300 hover:text-ink-100"
                  }`}>
                  {f}
                </button>
              ))}
              <button onClick={loadConversations} aria-label="Refresh" className="ml-auto rounded p-1.5 text-ink-400 hover:bg-ink-800">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visible.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-ink-400">
                No conversations yet. Connect WhatsApp, Instagram or Messenger in Settings → Channels — incoming messages appear here.
              </p>
            )}
            {visible.map((c) => {
              const meta = CHANNEL_META[c.channel];
              return (
                <button key={c.id} onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-3 border-b border-ink-800 px-3.5 py-3 text-left transition hover:bg-ink-900 ${
                    activeId === c.id ? "bg-ink-900" : ""
                  }`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.cls}`}>
                    <meta.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{c.customerName}</span>
                      <span className="shrink-0 text-[10px] text-ink-500">
                        {new Date(c.lastMessageAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-ink-400">{c.lastMessageText ?? ""}</span>
                      {c.unread > 0 && (
                        <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      )}
                    </span>
                    {(() => { const st = findStage(convStage(c, stages), stages); return (
                      <span className={`mt-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${colorOf(st.color).chip}`}>
                        {st.label}
                      </span>
                    ); })()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Thread */}
        <div className="relative flex min-h-0 min-w-0 flex-col">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-400">
              Select a conversation to start.
            </div>
          ) : (
            <>
              {/* Assignment top bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{active.customerName}</span>
                  <span className="badge-muted !text-[10px] capitalize">{CHANNEL_META[active.channel].label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="field !w-auto !py-1.5 !text-xs"
                    value={active.agentId ?? ""}
                    onChange={(e) => patchConversation({ agentId: e.target.value })}
                    title="Which agent answers this conversation"
                  >
                    <option value="">Agent Hub default</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <div className="flex overflow-hidden rounded-lg border border-ink-700">
                    <button
                      onClick={() => patchConversation({ aiEnabled: true })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition ${
                        active.aiEnabled ? "bg-[#301C3F] text-white" : "text-ink-300 hover:bg-ink-800"
                      }`}>
                      <Bot className="h-3.5 w-3.5" /> AI Agent
                    </button>
                    <button
                      onClick={() => patchConversation({ aiEnabled: false })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition ${
                        !active.aiEnabled ? "bg-[#301C3F] text-white" : "text-ink-300 hover:bg-ink-800"
                      }`}>
                      <User className="h-3.5 w-3.5" /> Me
                    </button>
                  </div>
                </div>
              </div>

              <div ref={scrollRef} onScroll={onThreadScroll} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
                {messages.map((m) =>
                  m.internal ? (
                    // Team-only comment — never went to the customer.
                    <div key={m.id} className="mx-auto w-full max-w-[85%] rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm text-amber-900">
                      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        <Lock className="h-3 w-3" /> Internal note · {(m.externalMsgId ?? "").replace(/^comment:/, "") || "You"}
                      </div>
                      {m.text}
                      <div className="mt-0.5 text-[10px] text-amber-700/70">
                        {new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                        m.direction === "out" ? "bg-[#301C3F] text-white" : "bg-ink-800 text-ink-100"
                      }`}>
                        {m.kind === "audio" ? (
                          <span className="flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" /> {m.text}</span>
                        ) : m.kind === "image" ? (
                          <span className="block">
                            {m.mediaUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.mediaUrl} alt={m.text || "image"} className="mb-1 max-h-52 rounded-lg" />
                            )}
                            {m.text && m.text !== "image" ? m.text : null}
                          </span>
                        ) : m.kind === "file" ? (
                          <span className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> {m.text || "File"}</span>
                        ) : m.text}
                        <div className={`mt-0.5 text-[10px] ${m.direction === "out" ? "text-white/60" : "text-ink-400"}`}>
                          {m.from === "agent" ? `AI · ${agentName(active.agentId)}` : m.from === "human" ? "You" : active.customerName}
                          {" · "}
                          {new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Jump to latest — appears when scrolled up */}
              {!atBottom && (
                <button
                  onClick={() => scrollToBottom("smooth")}
                  aria-label="Jump to latest"
                  className="absolute bottom-20 right-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-ink-700 bg-white text-[#301C3F] shadow-lg transition hover:bg-ink-50"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={onFilePicked}
              />

              {/* Composer */}
              <div className={`border-t px-4 pb-3 pt-2 ${mode === "comment" ? "border-amber-300 bg-amber-50/60" : "border-ink-700"}`}>
                {/* Reply / Comment mode tabs */}
                <div className="mb-2 flex items-center gap-1 text-xs">
                  <button onClick={() => { setMode("reply"); setTool(null); }}
                    className={`rounded-md px-2.5 py-1 font-semibold transition ${mode === "reply" ? "bg-[#301C3F] text-white" : "text-ink-400 hover:bg-ink-800"}`}>
                    Reply
                  </button>
                  <button onClick={() => { setMode("comment"); setTool(null); }}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition ${mode === "comment" ? "bg-amber-500 text-white" : "text-ink-400 hover:bg-ink-800"}`}>
                    <Lock className="h-3 w-3" /> Comment
                  </button>
                  {mode === "comment" && <span className="text-[11px] text-amber-700">Only your team sees this — the customer won&apos;t.</span>}
                </div>

                <div className="relative flex items-center gap-2">
                  {/* Tool popovers */}
                  {tool === "emoji" && (
                    <div className="absolute bottom-12 left-0 z-20 grid w-56 grid-cols-8 gap-0.5 rounded-xl border border-ink-700 bg-white p-2 shadow-xl">
                      {EMOJIS.map((e) => (
                        <button key={e} onClick={() => insert(e)} className="rounded p-1 text-lg hover:bg-ink-100">{e}</button>
                      ))}
                    </div>
                  )}
                  {tool === "snippets" && (
                    <div className="absolute bottom-12 left-0 z-20 w-72 space-y-1 rounded-xl border border-ink-700 bg-white p-2 shadow-xl">
                      <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Snippets</p>
                      {SNIPPETS.map((s) => (
                        <button key={s} onClick={() => insert(s)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-ink-200 hover:bg-ink-100">{s}</button>
                      ))}
                    </div>
                  )}
                  {tool === "vars" && (
                    <div className="absolute bottom-12 left-0 z-20 w-56 space-y-1 rounded-xl border border-ink-700 bg-white p-2 shadow-xl">
                      <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Variables</p>
                      {VARIABLES.map((v) => (
                        <button key={v.token} onClick={() => insert(v.token)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-ink-200 hover:bg-ink-100">
                          <span>{v.label}</span><span className="font-mono text-xs text-ink-400">{v.token}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {tool === "mention" && (
                    <div className="absolute bottom-12 left-0 z-20 w-56 space-y-1 rounded-xl border border-ink-700 bg-white p-2 shadow-xl">
                      <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Mention a teammate</p>
                      {members.length === 0 && <p className="px-2 py-1 text-xs text-ink-400">Invite team members in Settings → Users.</p>}
                      {members.map((mem) => (
                        <button key={mem.id} onClick={() => insert(`@${mem.name}`)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-ink-200 hover:bg-ink-100">@{mem.name}</button>
                      ))}
                    </div>
                  )}

                  {mode === "reply" && (
                    <button onClick={aiReply} disabled={busy}
                      title="Have the AI agent write and send the next reply"
                      className="btn-secondary flex shrink-0 items-center gap-1.5 !px-2.5 !py-2 !text-xs disabled:opacity-50">
                      <Sparkles className="h-3.5 w-3.5" /> AI
                    </button>
                  )}

                  {/* Toolbar */}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <ToolBtn active={tool === "emoji"} onClick={() => setTool(tool === "emoji" ? null : "emoji")} title="Emoji"><Smile className="h-4 w-4" /></ToolBtn>
                    {mode === "reply" ? (
                      <>
                        <ToolBtn active={tool === "snippets"} onClick={() => setTool(tool === "snippets" ? null : "snippets")} title="Snippets"><FileText className="h-4 w-4" /></ToolBtn>
                        <ToolBtn active={tool === "vars"} onClick={() => setTool(tool === "vars" ? null : "vars")} title="Variables"><Braces className="h-4 w-4" /></ToolBtn>
                        <ToolBtn active={false} onClick={pickFile} title="Attach a file (WhatsApp)"><Paperclip className="h-4 w-4" /></ToolBtn>
                      </>
                    ) : (
                      <ToolBtn active={tool === "mention"} onClick={() => setTool(tool === "mention" ? null : "mention")} title="Mention a teammate"><AtSign className="h-4 w-4" /></ToolBtn>
                    )}
                  </div>

                  <input
                    className={`field flex-1 !py-2.5 ${mode === "comment" ? "!border-amber-300 !bg-amber-50" : ""}`}
                    placeholder={mode === "comment" ? "Add an internal note… use @ to mention a teammate" : active.aiEnabled ? "AI answers automatically — type to jump in..." : "Type a message… / snippets, {{ }} variables"}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                  />

                  {mode === "reply" && (
                    <button onClick={toggleRecord}
                      title={active.channel === "whatsapp" ? (recording ? "Stop and send" : "Record a voice note") : "Voice notes: WhatsApp only"}
                      className={`shrink-0 rounded-lg border px-3 py-2.5 transition ${
                        recording ? "border-signal-red bg-signal-red/10 text-signal-red" : "border-ink-700 text-ink-300 hover:bg-ink-800"
                      }`}>
                      {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
                  <button onClick={send} disabled={busy || !text.trim()} aria-label={mode === "comment" ? "Post comment" : "Send"}
                    className={`shrink-0 !px-3.5 !py-2.5 disabled:opacity-50 ${mode === "comment" ? "rounded-lg bg-amber-500 text-white hover:bg-amber-600" : "btn-primary"}`}>
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Customer details (editable) */}
        <div className="hidden min-h-0 overflow-y-auto border-l border-ink-700 lg:block">
          {active ? (
            <ContactPanel
              key={active.id}
              active={active}
              contact={contact}
              stages={stages}
              agentName={agentName(active.agentId)}
              onSave={(p) => patchConversation(p)}
            />
          ) : (
            <p className="p-4 text-center text-sm text-ink-400">Customer details appear here.</p>
          )}
        </div>
      </div>

      {editStages && (
        <StageEditor
          initial={stages}
          onClose={() => setEditStages(false)}
          onSaved={(next) => { setStages(next); setEditStages(false); loadConversations(); }}
        />
      )}
    </div>
  );
}

// Small composer toolbar button.
function ToolBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`rounded-lg p-2 transition ${active ? "bg-ink-800 text-[#301C3F]" : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"}`}
    >
      {children}
    </button>
  );
}

// Editable contact details on the right, plus the lifecycle-stage picker and a
// "Manage" link into the full Contacts record.
function ContactPanel({
  active,
  contact,
  stages,
  agentName,
  onSave,
}: {
  active: Conversation;
  contact: Contact | null;
  stages: LifecycleStage[];
  agentName: string;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(active.customerName ?? "");
  const [phone, setPhone] = useState(active.customerPhone ?? "");
  const [email, setEmail] = useState(contact?.metadata?.email ?? "");
  const [editing, setEditing] = useState(false);

  const stage = convStage(active, stages);
  const dirty =
    name !== (active.customerName ?? "") ||
    phone !== (active.customerPhone ?? "") ||
    email !== (contact?.metadata?.email ?? "");

  function save() {
    onSave({ customerName: name.trim(), customerPhone: phone.trim(), email: email.trim() });
    setEditing(false);
  }

  return (
    <div className="p-4">
      <div className="flex flex-col items-center border-b border-ink-800 pb-4 text-center">
        <span className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${CHANNEL_META[active.channel].cls}`}>
          {(name || active.customerName).slice(0, 2).toUpperCase()}
        </span>
        <p className="mt-2 text-sm font-bold">{name || active.customerName}</p>
        <span className="badge-muted mt-2 !text-[10px] capitalize">{CHANNEL_META[active.channel].label}</span>
      </div>

      {/* Lifecycle stage */}
      <div className="mt-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Lifecycle stage</label>
        <select
          value={stage}
          onChange={(e) => onSave({ lifecycle: e.target.value })}
          className="field mt-1 !py-2 !text-sm"
        >
          {stages.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Editable contact fields */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Contact fields</span>
        <Link href="/dashboard/contacts" className="flex items-center gap-1 text-xs font-medium text-[#301C3F] hover:underline">
          Manage <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-2 space-y-3">
        <div>
          <label className="text-[11px] text-ink-500">Name</label>
          <input
            className="field !py-2 !text-sm"
            value={name}
            onChange={(e) => { setName(e.target.value); setEditing(true); }}
          />
        </div>
        <div>
          <label className="text-[11px] text-ink-500">Phone number</label>
          <input
            className="field !py-2 !text-sm"
            value={phone}
            placeholder="+971 50 000 0000"
            onChange={(e) => { setPhone(e.target.value); setEditing(true); }}
          />
        </div>
        <div>
          <label className="text-[11px] text-ink-500">Email address</label>
          <input
            className="field !py-2 !text-sm"
            type="email"
            value={email}
            placeholder="Add email address"
            onChange={(e) => { setEmail(e.target.value); setEditing(true); }}
          />
        </div>
        {(editing || dirty) && (
          <button onClick={save} disabled={!dirty} className="btn-primary w-full !py-2 !text-sm disabled:opacity-50">
            Save contact
          </button>
        )}
      </div>

      <dl className="mt-5 space-y-3 border-t border-ink-800 pt-4 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Handled by</dt>
          <dd className="mt-0.5 flex items-center gap-1.5">
            {active.aiEnabled ? (<><Bot className="h-3.5 w-3.5 text-ink-400" /> {agentName}</>)
              : (<><User className="h-3.5 w-3.5 text-ink-400" /> {active.assignee ?? "You"}</>)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">First contact</dt>
          <dd className="mt-0.5">{new Date(active.createdAt).toLocaleDateString()}</dd>
        </div>
      </dl>
    </div>
  );
}

// Add / rename / recolor / reorder / delete lifecycle stages.
function StageEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: LifecycleStage[];
  onClose: () => void;
  onSaved: (stages: LifecycleStage[]) => void;
}) {
  const [rows, setRows] = useState<LifecycleStage[]>(initial.map((s) => ({ ...s })));
  const [busy, setBusy] = useState(false);

  function update(i: number, patch: Partial<LifecycleStage>) {
    setRows((r) => r.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function move(i: number, dir: -1 | 1) {
    setRows((r) => {
      const next = [...r];
      const j = i + dir;
      if (j < 0 || j >= next.length) return r;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function remove(i: number) {
    setRows((r) => (r.length <= 1 ? r : r.filter((_, idx) => idx !== i)));
  }
  function add() {
    setRows((r) => [
      ...r,
      { key: "", label: "New stage", color: STAGE_COLOR_KEYS[r.length % STAGE_COLOR_KEYS.length] },
    ]);
  }

  async function save() {
    const cleaned = rows.filter((s) => s.label.trim());
    if (!cleaned.length) return toastError("Add at least one stage.");
    setBusy(true);
    const res = await fetch("/api/inbox/stages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stages: cleaned }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && Array.isArray(data.stages)) {
      toast("Lifecycle stages saved.");
      onSaved(data.stages);
    } else {
      toastError(data.error ?? "Could not save stages.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Lifecycle stages</h3>
          <button onClick={onClose} className="rounded p-1 text-ink-400 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-sm text-ink-400">Rename, recolor, reorder and add the stages leads move through.</p>

        <div className="mt-4 space-y-2">
          {rows.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`h-3 w-3 shrink-0 rounded-full ${colorOf(s.color).dot}`} />
              <input
                value={s.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="field !py-1.5 !text-sm flex-1"
                placeholder="Stage name"
              />
              <select
                value={s.color}
                onChange={(e) => update(i, { color: e.target.value })}
                className="field !w-auto !py-1.5 !text-xs capitalize"
              >
                {STAGE_COLOR_KEYS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(i)} disabled={rows.length <= 1} className="rounded p-1 text-signal-red hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>

        <button onClick={add} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#301C3F] hover:underline">
          <Plus className="h-4 w-4" /> Add stage
        </button>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary !text-sm">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-primary !text-sm disabled:opacity-60">
            {busy ? "Saving…" : "Save stages"}
          </button>
        </div>
      </div>
    </div>
  );
}
