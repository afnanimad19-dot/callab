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
  Bot, User, Sparkles, Phone, SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import type { Agent, ChatMessage, Conversation } from "@/lib/db";
import { toast, toastError } from "@/components/Toast";

const CHANNEL_META = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, cls: "bg-emerald-100 text-emerald-700" },
  instagram: { label: "Instagram", icon: Camera, cls: "bg-pink-100 text-pink-700" },
  messenger: { label: "Messenger", icon: MessagesSquare, cls: "bg-blue-100 text-blue-700" },
} as const;

export default function InboxPanel({ agents }: { agents: Agent[] }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState<"all" | "whatsapp" | "instagram" | "messenger">("all");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { if (activeId) loadThread(activeId); }, [activeId, loadThread]);
  // Light polling keeps the thread live while the tab is open.
  useEffect(() => {
    const t = setInterval(() => {
      loadConversations();
      if (activeId) loadThread(activeId);
    }, 12000);
    return () => clearInterval(t);
  }, [activeId, loadConversations, loadThread]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const visible = conversations
    .filter((c) => filter === "all" || c.channel === filter)
    .filter((c) => {
      const q = query.trim().toLowerCase();
      return !q || `${c.customerName} ${c.customerPhone ?? ""} ${c.lastMessageText ?? ""}`.toLowerCase().includes(q);
    });

  async function send() {
    const body = text.trim();
    if (!body || !active || busy) return;
    setBusy(true);
    setText("");
    const res = await fetch(`/api/inbox/${active.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMessages((m) => [...m, data.message]);
      if (data.delivered === false) toastError("Saved, but the channel didn't accept the message — check Settings → Channels.");
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

  const agentName = (id?: string) =>
    agents.find((a) => a.id === id)?.name ?? "Default agent";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-ink-400">
            WhatsApp, Instagram and Messenger conversations — answered by your agents or by you
          </p>
        </div>
        <Link href="/dashboard/settings" className="btn-secondary flex items-center gap-1.5 !text-sm">
          <SlidersHorizontal className="h-4 w-4" /> Channel settings
        </Link>
      </div>

      <div className="card grid min-h-[620px] grid-cols-1 !p-0 lg:grid-cols-[300px_1fr_260px]">
        {/* Conversation list */}
        <div className="flex flex-col border-r border-ink-700">
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
                        <span className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-[#301C3F] px-1 text-[10px] font-bold text-white">
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Thread */}
        <div className="flex min-w-0 flex-col">
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

              <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      m.direction === "out" ? "bg-[#301C3F] text-white" : "bg-ink-800 text-ink-100"
                    }`}>
                      {m.kind === "audio" ? (
                        <span className="flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" /> {m.text}</span>
                      ) : m.text}
                      <div className={`mt-0.5 text-[10px] ${m.direction === "out" ? "text-white/60" : "text-ink-400"}`}>
                        {m.from === "agent" ? `AI · ${agentName(active.agentId)}` : m.from === "human" ? "You" : active.customerName}
                        {" · "}
                        {new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Composer */}
              <div className="flex items-center gap-2 border-t border-ink-700 px-4 py-3">
                <button onClick={aiReply} disabled={busy}
                  title="Have the AI agent write and send the next reply"
                  className="btn-secondary flex items-center gap-1.5 !px-3 !py-2 !text-xs disabled:opacity-50">
                  <Sparkles className="h-3.5 w-3.5" /> AI reply
                </button>
                <input
                  className="field flex-1 !py-2.5"
                  placeholder={active.aiEnabled ? "AI answers automatically — type to jump in..." : "Type a message..."}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                <button onClick={toggleRecord}
                  title={active.channel === "whatsapp" ? (recording ? "Stop and send" : "Record a voice note") : "Voice notes: WhatsApp only"}
                  className={`rounded-lg border px-3 py-2.5 transition ${
                    recording ? "border-signal-red bg-signal-red/10 text-signal-red" : "border-ink-700 text-ink-300 hover:bg-ink-800"
                  }`}>
                  {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <button onClick={send} disabled={busy || !text.trim()} aria-label="Send"
                  className="btn-primary !px-3.5 !py-2.5 disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Customer details */}
        <div className="hidden border-l border-ink-700 lg:block">
          {active ? (
            <div className="p-4">
              <div className="flex flex-col items-center border-b border-ink-800 pb-4 text-center">
                <span className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${CHANNEL_META[active.channel].cls}`}>
                  {active.customerName.slice(0, 2).toUpperCase()}
                </span>
                <p className="mt-2 text-sm font-bold">{active.customerName}</p>
                {active.customerPhone && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400">
                    <Phone className="h-3 w-3" /> {active.customerPhone}
                  </p>
                )}
                <span className="badge-muted mt-2 !text-[10px] capitalize">{CHANNEL_META[active.channel].label}</span>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Handled by</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5">
                    {active.aiEnabled ? (<><Bot className="h-3.5 w-3.5 text-ink-400" /> {agentName(active.agentId)}</>)
                      : (<><User className="h-3.5 w-3.5 text-ink-400" /> {active.assignee ?? "You"}</>)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">First contact</dt>
                  <dd className="mt-0.5">{new Date(active.createdAt).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Contact record</dt>
                  <dd className="mt-0.5">
                    {active.contactId ? (
                      <Link href="/dashboard/contacts" className="font-medium text-[#301C3F] underline-offset-2 hover:underline">
                        View in Contacts
                      </Link>
                    ) : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="p-4 text-center text-sm text-ink-400">Customer details appear here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
