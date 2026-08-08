"use client";

// Test-call popups for the agent editor and Flow Designer:
//  - PhoneTestCallModal ("Test Agent — {name}"): call the user's own phone
//    from one of the workspace numbers, with dynamic variables.
//  - WebCallModal: in-browser voice call with the animated gradient bubble
//    (idle spin, pulses with the live volume), mute / message / call controls.
// Web calls are logged to Call Logs as tests, like the Test Agent panel.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, Plus, Trash2, Phone, PhoneOff, Mic, MicOff, ChevronDown,
  MessageSquare, Send,
} from "lucide-react";
import type { Agent, PhoneNumber } from "@/lib/db";
import { toast, toastError } from "@/components/Toast";

const COUNTRIES = [
  { name: "United Arab Emirates", code: "+971" },
  { name: "Saudi Arabia", code: "+966" },
  { name: "Qatar", code: "+974" },
  { name: "Kuwait", code: "+965" },
  { name: "United States", code: "+1" },
  { name: "United Kingdom", code: "+44" },
  { name: "Germany", code: "+49" },
  { name: "France", code: "+33" },
  { name: "India", code: "+91" },
  { name: "Pakistan", code: "+92" },
  { name: "Egypt", code: "+20" },
  { name: "Australia", code: "+61" },
];

// --- Phone test call ---------------------------------------------------------

export function PhoneTestCallModal({
  agent,
  phoneNumbers,
  onClose,
}: {
  agent: Agent;
  phoneNumbers: PhoneNumber[];
  onClose: () => void;
}) {
  const [country, setCountry] = useState(COUNTRIES[0].code);
  const [number, setNumber] = useState("");
  const [customFormat, setCustomFormat] = useState(false);
  const [customNumber, setCustomNumber] = useState("");
  const [fromId, setFromId] = useState("");
  const [vars, setVars] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCall() {
    const customerNumber = customFormat
      ? customNumber.trim()
      : `${country}${number.replace(/[^\d]/g, "")}`;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/test-calls/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: agent.id,
        customerNumber,
        phoneNumberId: fromId,
        variables: Object.fromEntries(vars.filter((v) => v.key).map((v) => [v.key, v.value])),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      toast(`Calling ${customerNumber} — pick up to talk to ${agent.name}.`);
      onClose();
    } else {
      setError(data.error ?? "Could not start the test call.");
      toastError(data.error ?? "Could not start the test call.");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Test Agent - {agent.name}</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <label className="label">Your Phone Number</label>
            {customFormat ? (
              <input className="field" placeholder="Full number, e.g. +9715xxxxxxxx"
                value={customNumber} onChange={(e) => setCustomNumber(e.target.value)} />
            ) : (
              <div className="flex gap-2">
                <select className="field w-44 shrink-0" value={country} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
                <input className="field flex-1" placeholder="Number without country code"
                  value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
            )}
            <label className="mt-2 flex items-center justify-end gap-2 text-xs text-ink-300">
              <input type="checkbox" checked={customFormat} onChange={(e) => setCustomFormat(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink-600" />
              Use Custom Format
            </label>
          </div>

          <div>
            <label className="label">Call From</label>
            <select className="field" value={fromId} onChange={(e) => setFromId(e.target.value)}>
              <option value="">Select a number</option>
              {phoneNumbers.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.number}{n.nickname ? ` — ${n.nickname}` : ""}{n.vapiPhoneNumberId ? "" : " (not linked to Vapi)"}
                </option>
              ))}
            </select>
            {phoneNumbers.length === 0 && (
              <p className="mt-1 text-xs text-ink-400">No workspace numbers yet — add one in Phone Numbers first.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label !mb-0">Dynamic Variables</label>
              <button onClick={() => setVars((v) => [...v, { key: "", value: "" }])}
                aria-label="Add variable" className="btn-secondary !px-2.5 !py-1.5"><Plus className="h-3.5 w-3.5" /></button>
            </div>
            <div className="mt-2 space-y-2">
              {vars.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <input className="field flex-1" placeholder="Key" value={v.key}
                    onChange={(e) => setVars(vars.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                  <input className="field flex-1" placeholder="Value" value={v.value}
                    onChange={(e) => setVars(vars.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  {vars.length > 1 && (
                    <button onClick={() => setVars(vars.filter((_, j) => j !== i))} aria-label="Remove variable"
                      className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-signal-red">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-4 py-2.5 text-sm text-signal-red">{error}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={startCall}
            disabled={busy || !fromId || (customFormat ? !customNumber.trim() : !number.trim())}
            className="btn-primary disabled:opacity-50"
          >
            {busy ? "Starting…" : "Start Test Call"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Web call (browser voice) ------------------------------------------------

interface Turn {
  speaker: "agent" | "caller";
  text: string;
  at: number;
}

export function WebCallModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "connecting" | "live">("idle");
  const [muted, setMuted] = useState(false);
  const [talking, setTalking] = useState(false);
  const [level, setLevel] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [micMenu, setMicMenu] = useState(false);
  const [mics, setMics] = useState<string[]>([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msg, setMsg] = useState("");

  const vapiRef = useRef<{
    stop: () => void;
    setMuted?: (m: boolean) => void;
    send?: (m: unknown) => void;
  } | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const vapiCallIdRef = useRef<string | null>(null);
  const loggedRef = useRef(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => vapiRef.current?.stop(), []);

  // Smoothly drive the bubble scale from the SDK's volume-level events.
  useEffect(() => {
    bubbleRef.current?.style.setProperty("--level", String(Math.min(1, level * 2)));
  }, [level]);

  function secondsFromStart() {
    if (!startedAtRef.current) return 0;
    return Math.round((Date.now() - Date.parse(startedAtRef.current)) / 1000);
  }

  async function logSession() {
    if (loggedRef.current) return;
    const happened = turnsRef.current.length > 0 || (startedAtRef.current && secondsFromStart() > 0);
    if (!happened) return;
    loggedRef.current = true;
    try {
      await fetch("/api/test-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          mode: "voice",
          startedAt: startedAtRef.current ?? new Date().toISOString(),
          durationSec: secondsFromStart(),
          transcript: turnsRef.current,
          vapiCallId: vapiCallIdRef.current,
        }),
      });
      toast("Web call logged to Call Logs.");
      router.refresh();
    } catch {
      loggedRef.current = false;
    }
  }

  async function start() {
    setNotice(null);
    setState("connecting");
    try {
      const keyRes = await fetch("/api/vapi/public-key").then((r) => r.json());
      const publicKey = keyRes.publicKey;
      if (!publicKey) {
        setState("idle");
        setNotice("Web calls need VAPI_PUBLIC_KEY set in your environment variables.");
        return;
      }
      let assistantId = agent.vapiAssistantId;
      if (!assistantId) {
        const res = await fetch(`/api/agents/${agent.id}/sync`, { method: "POST" });
        const data = await res.json();
        assistantId = data.vapiAssistantId ?? undefined;
        if (!assistantId) {
          setState("idle");
          setNotice(data.error ?? "Couldn't sync this agent to Vapi — check VAPI_API_KEY.");
          return;
        }
      }
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(publicKey);
      vapiRef.current = vapi as unknown as typeof vapiRef.current;
      vapi.on("call-start", () => {
        startedAtRef.current = startedAtRef.current ?? new Date().toISOString();
        setState("live");
        setMuted(false);
      });
      vapi.on("call-end", () => {
        setState("idle");
        setTalking(false);
        setLevel(0);
        logSession();
      });
      vapi.on("speech-start", () => setTalking(true));
      vapi.on("speech-end", () => setTalking(false));
      vapi.on("volume-level", (v: number) => setLevel(v));
      vapi.on("error", (e: unknown) => {
        console.error(e);
        setState("idle");
        setNotice("Voice call failed — check your Vapi keys and the agent sync.");
      });
      vapi.on("message", (m: { type?: string; transcriptType?: string; role?: string; transcript?: string }) => {
        if (m.type === "transcript" && m.transcriptType === "final" && m.transcript) {
          turnsRef.current = [
            ...turnsRef.current,
            { speaker: m.role === "assistant" ? "agent" : "caller", text: m.transcript, at: secondsFromStart() },
          ];
        }
      });
      const call = (await vapi.start(assistantId)) as { id?: string } | null;
      if (call?.id) vapiCallIdRef.current = call.id;
    } catch (e) {
      console.error(e);
      setState("idle");
      setNotice("Could not start the voice call in this browser.");
    }
  }

  function stop() {
    vapiRef.current?.stop();
    setState("idle");
    setTalking(false);
    setLevel(0);
  }

  function toggleMute() {
    const next = !muted;
    vapiRef.current?.setMuted?.(next);
    setMuted(next);
  }

  async function openMicMenu() {
    setMicMenu((v) => !v);
    if (mics.length === 0) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setMics(devices.filter((d) => d.kind === "audioinput").map((d) => d.label || "Microphone"));
      } catch {
        setMics(["Default microphone"]);
      }
    }
  }

  function sendMessage() {
    const text = msg.trim();
    if (!text || state !== "live") return;
    vapiRef.current?.send?.({ type: "add-message", message: { role: "user", content: text } });
    turnsRef.current = [...turnsRef.current, { speaker: "caller", text, at: secondsFromStart() }];
    setMsg("");
    setMsgOpen(false);
  }

  async function handleClose() {
    stop();
    await logSession();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="flex min-h-[560px] w-full max-w-sm flex-col rounded-2xl border border-ink-700 bg-ink-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold">Web Call</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400">
              <span className={`h-1.5 w-1.5 rounded-full ${
                state === "live" ? "bg-emerald-500" : state === "connecting" ? "animate-pulse bg-amber-400" : "bg-ink-500"
              }`} />
              {state === "live" ? "Live" : state === "connecting" ? "Connecting" : "Idle"}
            </p>
          </div>
          <button onClick={handleClose} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X className="h-4 w-4" /></button>
        </div>

        <p className="mt-4 text-center text-lg font-bold">{agent.name}</p>

        <div className="flex flex-1 items-center justify-center py-6">
          <div ref={bubbleRef} className={`voice-bubble ${talking ? "talking" : ""}`} aria-hidden />
        </div>

        {notice && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p>
        )}

        {msgOpen && state === "live" && (
          <div className="mb-3 flex items-center gap-2">
            <input
              autoFocus
              className="field flex-1 !py-2"
              placeholder="Type a message to the agent..."
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage} aria-label="Send message" className="btn-primary !px-3 !py-2">
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="relative mx-auto flex items-center gap-2 rounded-full border border-ink-700 bg-ink-950 px-3 py-2 shadow-lg">
          <div className="flex items-center">
            <button
              onClick={toggleMute}
              disabled={state !== "live"}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition disabled:opacity-40 ${
                muted ? "bg-amber-100 text-amber-700" : "hover:bg-ink-800 text-ink-200"
              }`}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button onClick={openMicMenu} aria-label="Microphone options"
              className="flex h-10 w-5 items-center justify-center rounded-full text-ink-400 hover:text-ink-100">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => setMsgOpen((v) => !v)}
            disabled={state !== "live"}
            aria-label="Send a text message"
            className={`flex h-10 w-10 items-center justify-center rounded-full transition disabled:opacity-40 ${
              msgOpen ? "bg-ink-800 text-ink-100" : "hover:bg-ink-800 text-ink-200"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          {state === "idle" ? (
            <button onClick={start} aria-label="Start call"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-600">
              <Phone className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={stop} aria-label="End call"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-signal-red text-white transition hover:opacity-90">
              <PhoneOff className="h-5 w-5" />
            </button>
          )}

          {micMenu && (
            <div className="absolute bottom-14 left-0 z-10 w-56 rounded-xl border border-ink-700 bg-ink-950 py-1 shadow-xl">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Microphones</p>
              {(mics.length ? mics : ["Default microphone"]).map((m, i) => (
                <p key={i} className="truncate px-3 py-1.5 text-sm text-ink-200">{m}</p>
              ))}
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] text-ink-500">
          Web calls are logged to Call Logs as tests.
        </p>
      </div>
    </div>
  );
}
