"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface LiveTurn {
  speaker: "agent" | "caller";
  text: string;
}

interface LiveCall {
  id: string;
  agentName: string;
  topic: string;
  callerNumber: string;
  elapsedSec: number;
  sentiment: "positive" | "negative";
  confidence: number;
  needsAttention: boolean;
  status: "in_progress" | "wrapping_up";
  transcript: LiveTurn[];
}

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function LiveConsole() {
  const [calls, setCalls] = useState<LiveCall[] | null>(null);
  const [takenOver, setTakenOver] = useState<Record<string, boolean>>({});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls);
      }
    } catch {
      // transient network error — keep last state, next poll retries
    }
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  if (calls === null) {
    return (
      <div className="card py-12 text-center text-sm text-ink-400">
        Connecting to the live feed…
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="card py-12 text-center text-sm text-ink-400">
        No active calls right now. New calls appear here the moment they connect.
        <br />
        (Tip: make sure at least one agent is set to <span className="text-accent-400">active</span>.)
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {calls.map((call) => {
        const isTaken = takenOver[call.id];
        return (
          <div
            key={call.id}
            className={`card flex flex-col !p-0 ${
              call.needsAttention && !isTaken ? "!border-signal-red/60" : ""
            }`}
          >
            <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
              <div>
                <p className="text-sm font-semibold">
                  {call.agentName}
                  <span className="ml-2 font-normal text-ink-400">{call.callerNumber}</span>
                </p>
                <p className="text-xs text-ink-400">{call.topic}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-ink-300">{formatElapsed(call.elapsedSec)}</span>
                {call.needsAttention && !isTaken ? (
                  <span className="rounded-full bg-signal-red/15 px-2.5 py-1 font-semibold text-signal-red">
                    Needs attention
                  </span>
                ) : isTaken ? (
                  <span className="rounded-full bg-signal-amber/15 px-2.5 py-1 font-semibold text-signal-amber">
                    Supervisor on call
                  </span>
                ) : (
                  <span className="rounded-full bg-accent-500/15 px-2.5 py-1 font-medium text-accent-400">
                    {call.status === "wrapping_up" ? "wrapping up" : "in progress"}
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-56 flex-1 space-y-2.5 overflow-y-auto px-5 py-4 font-mono text-[13px] leading-relaxed">
              {call.transcript.map((t, i) => (
                <p key={i}>
                  <span className={t.speaker === "agent" ? "text-accent-400" : "text-signal-blue"}>
                    {t.speaker}
                  </span>{" "}
                  <span className="text-ink-200">{t.text}</span>
                </p>
              ))}
              <p className="text-ink-500">…</p>
            </div>

            <div className="flex items-center justify-between border-t border-ink-700 bg-ink-800/40 px-5 py-3">
              <p className="text-xs text-ink-400">
                Sentiment{" "}
                <span
                  className={
                    call.sentiment === "positive"
                      ? "font-medium text-accent-400"
                      : "font-medium text-signal-red"
                  }
                >
                  {call.sentiment}
                </span>
                <span className="mx-2 text-ink-600">·</span>
                Confidence{" "}
                <span className="font-medium text-ink-200">
                  {Math.round(call.confidence * 100)}%
                </span>
              </p>
              <button
                onClick={() =>
                  setTakenOver((prev) => ({ ...prev, [call.id]: !prev[call.id] }))
                }
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  isTaken
                    ? "bg-signal-amber/20 text-signal-amber hover:bg-signal-amber/30"
                    : "bg-accent-500 text-ink-950 hover:bg-accent-400"
                }`}
              >
                {isTaken ? "Return to AI" : "Take over call"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
