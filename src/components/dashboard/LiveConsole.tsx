"use client";

// Live monitoring console. Polls /api/live for the calls Vapi currently has on
// the line for this workspace and shows each one with a ticking timer. This is
// real state — when no calls are live, the list is genuinely empty.

import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneCall, Radio } from "lucide-react";

interface LiveCall {
  id: string;
  agentId: string;
  agentName: string;
  callerNumber: string;
  elapsedSec: number;
  status: string;
  canListen: boolean;
}

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  queued: "queued",
  ringing: "ringing",
  "in-progress": "in progress",
  forwarding: "transferring",
};

export default function LiveConsole() {
  const [calls, setCalls] = useState<LiveCall[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls);
        setConfigured(data.configured !== false);
      }
    } catch {
      // transient network error — keep last state, next poll retries
    }
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  if (calls === null) {
    return (
      <div className="card py-12 text-center text-sm text-ink-400">
        Loading live calls…
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="card py-12 text-center text-sm text-ink-400">
        Live monitoring turns on once the voice pipeline is connected.
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-800 text-ink-400">
          <PhoneCall className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-ink-200">No calls in progress right now</p>
        <p className="max-w-sm text-sm text-ink-400">
          Active calls appear here the moment they connect, with a live timer and status.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {calls.map((call) => (
        <div key={call.id} className="card flex flex-col !p-0">
          <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
            <div>
              <p className="text-sm font-semibold">
                {call.agentName}
                <span className="ml-2 font-normal text-ink-400">{call.callerNumber}</span>
              </p>
              <p className="text-xs text-ink-400">Call {call.id.slice(0, 8)}</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-ink-300">{formatElapsed(call.elapsedSec)}</span>
              <span className="flex items-center gap-1.5 rounded-full bg-accent-500/15 px-2.5 py-1 font-medium text-accent-400">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulseDot" />
                {STATUS_LABEL[call.status] ?? call.status}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-4 text-sm text-ink-400">
            <span className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-accent-400" />
              {call.canListen ? "Live audio available" : "Connecting…"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
