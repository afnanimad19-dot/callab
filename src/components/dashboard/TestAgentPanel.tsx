"use client";

// Test Agent slide-over: pick an agent, then talk to it by text (Vapi Chat
// API with a simulated fallback) or by voice (@vapi-ai/web browser SDK when
// VAPI_PUBLIC_KEY is configured and the agent is synced to Vapi). Ending a
// session logs it into Call Logs marked as a test, with date/time.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Send,
  Mic,
  MicOff,
  MessageSquare,
  AudioLines,
  FlaskConical,
  PhoneOff,
  Volume2,
  VolumeX,
  ChevronDown,
  Check,
} from "lucide-react";
import type { Agent } from "@/lib/db";

interface Turn {
  speaker: "agent" | "caller";
  text: string;
  at: number; // seconds from start
}

export default function TestAgentPanel({
  agents,
  initialAgentId,
  onClose,
}: {
  agents: Agent[];
  initialAgentId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [agentId, setAgentId] = useState(initialAgentId ?? agents[0]?.id ?? "");
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "connecting" | "live">("idle");
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const startedAtRef = useRef<string | null>(null);
  const chatIdRef = useRef<string | undefined>(undefined);
  const turnsRef = useRef<Turn[]>([]);
  const vapiRef = useRef<{ stop: () => void; setMuted?: (m: boolean) => void } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const agent = agents.find((a) => a.id === agentId);

  // Close the agent picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    function onDocClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [pickerOpen]);

  useEffect(() => {
    fetch("/api/vapi/public-key")
      .then((r) => r.json())
      .then((d) => setPublicKey(d.publicKey ?? null))
      .catch(() => setPublicKey(null));
  }, []);

  useEffect(() => {
    turnsRef.current = turns;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  // Stop any live voice call when the panel unmounts.
  useEffect(() => () => vapiRef.current?.stop(), []);

  function secondsFromStart() {
    if (!startedAtRef.current) return 0;
    return Math.round((Date.now() - Date.parse(startedAtRef.current)) / 1000);
  }

  function pushTurn(speaker: Turn["speaker"], text: string) {
    if (!text.trim()) return;
    setTurns((t) => [...t, { speaker, text, at: secondsFromStart() }]);
  }

  function resetSession() {
    setTurns([]);
    startedAtRef.current = null;
    chatIdRef.current = undefined;
    setNotice(null);
  }

  // --- Text testing ---------------------------------------------------------

  async function sendText() {
    const message = input.trim();
    if (!message || !agent || busy) return;
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();
    setInput("");
    pushTurn("caller", message);
    setBusy(true);
    try {
      const res = await fetch("/api/test-calls/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          message,
          previousChatId: chatIdRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat failed");
      chatIdRef.current = data.chatId;
      pushTurn("agent", data.reply);
      if (data.live === false && !notice) {
        setNotice("Simulated replies — sync this agent to Vapi to test the real model.");
      }
    } catch (e) {
      pushTurn("agent", `⚠ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // --- Voice testing --------------------------------------------------------

  async function startVoice() {
    if (!agent) return;
    if (!publicKey) {
      setNotice("Voice testing needs VAPI_PUBLIC_KEY set in your environment variables.");
      return;
    }
    setVoiceState("connecting");
    setNotice(null);

    // Sync the agent to Vapi on the fly if it was created before Vapi was
    // configured — no manual re-save needed.
    let assistantId = agent.vapiAssistantId;
    if (!assistantId) {
      try {
        const res = await fetch(`/api/agents/${agent.id}/sync`, { method: "POST" });
        const data = await res.json();
        assistantId = data.vapiAssistantId ?? undefined;
        if (assistantId) agent.vapiAssistantId = assistantId;
        if (!assistantId) {
          setVoiceState("idle");
          setNotice(
            data.error ??
              "Couldn't sync this agent to Vapi — check VAPI_API_KEY on the server."
          );
          return;
        }
      } catch {
        setVoiceState("idle");
        setNotice("Couldn't reach the server to sync this agent to Vapi.");
        return;
      }
    }

    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(publicKey);
      vapiRef.current = vapi;
      vapi.on("call-start", () => {
        startedAtRef.current = startedAtRef.current ?? new Date().toISOString();
        setVoiceState("live");
        setMuted(false);
      });
      vapi.on("call-end", () => {
        setVoiceState("idle");
        setMuted(false);
      });
      vapi.on("error", (e: unknown) => {
        console.error(e);
        setVoiceState("idle");
        setNotice("Voice call failed — check your Vapi public key and assistant.");
      });
      vapi.on("message", (m: { type?: string; transcriptType?: string; role?: string; transcript?: string }) => {
        if (m.type === "transcript" && m.transcriptType === "final" && m.transcript) {
          pushTurn(m.role === "assistant" ? "agent" : "caller", m.transcript);
        }
      });
      await vapi.start(assistantId);
    } catch (e) {
      console.error(e);
      setVoiceState("idle");
      setNotice("Could not start the voice call in this browser.");
    }
  }

  function stopVoice() {
    vapiRef.current?.stop();
    setVoiceState("idle");
    setMuted(false);
  }

  function toggleMute() {
    const next = !muted;
    vapiRef.current?.setMuted?.(next);
    setMuted(next);
  }

  // --- Logging --------------------------------------------------------------

  async function endAndLog() {
    if (!agent) return;
    stopVoice();
    const transcript = turnsRef.current;
    if (transcript.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/test-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          mode,
          startedAt: startedAtRef.current ?? new Date().toISOString(),
          durationSec: secondsFromStart(),
          transcript,
        }),
      });
      router.refresh();
    } finally {
      setBusy(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-ink-700 bg-ink-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#301C3F]/10 text-[#301C3F]">
              <FlaskConical className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Test Agent</h2>
              <p className="text-xs text-ink-400">Sessions are logged in Call Logs as tests</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Agent + mode */}
        <div className="space-y-3 border-b border-ink-700 px-5 py-4">
          <div ref={pickerRef} className="relative">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="field flex w-full items-center justify-between !py-2.5 text-left"
            >
              <span className="truncate">
                {agent ? `${agent.name} — ${agent.role}` : "No agents yet"}
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-ink-400 transition ${pickerOpen ? "rotate-180" : ""}`} />
            </button>
            {pickerOpen && (
              <div className="absolute inset-x-0 top-12 z-20 max-h-[26rem] overflow-y-auto rounded-xl border border-ink-700 bg-ink-950 py-1 shadow-xl shadow-black/20">
                {agents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setPickerOpen(false);
                      if (a.id !== agentId) {
                        stopVoice();
                        setAgentId(a.id);
                        resetSession();
                      }
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition hover:bg-ink-800 ${
                      a.id === agentId ? "bg-ink-800/60" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.name}</span>
                      <span className="block truncate text-xs text-ink-400">{a.role}</span>
                    </span>
                    {a.id === agentId && <Check className="h-4 w-4 shrink-0 text-[#301C3F]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("text")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                mode === "text"
                  ? "border-[#301C3F] bg-[#301C3F] text-white"
                  : "border-ink-700 text-ink-300 hover:bg-ink-800"
              }`}
            >
              <MessageSquare className="h-4 w-4" /> Text
            </button>
            <button
              onClick={() => setMode("voice")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                mode === "voice"
                  ? "border-[#301C3F] bg-[#301C3F] text-white"
                  : "border-ink-700 text-ink-300 hover:bg-ink-800"
              }`}
            >
              <AudioLines className="h-4 w-4" /> Voice
            </button>
          </div>
          {notice && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p>
          )}
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {turns.length === 0 && (
            <p className="pt-10 text-center text-sm text-ink-400">
              {mode === "text"
                ? "Send a message to start testing this agent."
                : "Start a voice call and speak — the transcript appears here."}
            </p>
          )}
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.speaker === "caller" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  t.speaker === "caller"
                    ? "bg-[#301C3F] text-white"
                    : "bg-ink-800 text-ink-100"
                }`}
              >
                {t.text}
                <div className={`mt-1 text-[10px] ${t.speaker === "caller" ? "text-white/60" : "text-ink-400"}`}>
                  {t.speaker === "caller" ? "You" : agent?.name ?? "Agent"} · {t.at}s
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="border-t border-ink-700 px-5 py-4">
          {mode === "text" ? (
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendText()}
                placeholder="Type a message..."
                disabled={!agent || busy}
                className="field flex-1 !py-2.5"
              />
              <button
                onClick={sendText}
                disabled={!agent || busy || !input.trim()}
                aria-label="Send"
                className="btn-primary !px-3.5 !py-2.5 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
            <div className="flex items-center gap-2">
              {voiceState === "idle" ? (
                <button onClick={startVoice} disabled={!agent} className="btn-primary flex flex-1 items-center justify-center gap-2 !py-2.5">
                  <Mic className="h-4 w-4" /> Start voice call
                </button>
              ) : (
                <>
                  <button
                    onClick={toggleMute}
                    disabled={voiceState !== "live"}
                    title={muted ? "Unmute microphone" : "Mute microphone"}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
                      muted
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-ink-700 text-ink-300 hover:bg-ink-800"
                    }`}
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    {muted ? "Unmute" : "Mute"}
                  </button>
                  <button onClick={stopVoice} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-signal-red px-3 py-2.5 text-sm font-medium text-white">
                    {voiceState === "connecting" ? <MicOff className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
                    {voiceState === "connecting" ? "Connecting…" : "End call"}
                  </button>
                </>
              )}
            </div>
            {voiceState === "live" && (
              <p className="mt-2 flex items-center justify-center gap-2 text-xs text-emerald-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live — speak now
                {muted && <span className="text-amber-600">(mic muted)</span>}
              </p>
            )}
            </>
          )}
          <button
            onClick={endAndLog}
            disabled={busy}
            className="btn-secondary mt-2 w-full !py-2.5 text-sm"
          >
            End test & log to Call Logs
          </button>
        </div>
      </div>
    </div>
  );
}
