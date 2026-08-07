"use client";

// The embeddable web-call widget: fetches the public agent config and starts
// a browser voice call via Vapi's web SDK. Rendered inside an iframe on any
// site that pastes the embed code from the agent's Share dialog.

import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff } from "lucide-react";

interface EmbedConfig {
  name: string;
  role: string;
  greeting: string;
  assistantId: string | null;
  publicKey: string | null;
}

export default function EmbedWidget({ agentId }: { agentId: string }) {
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "connecting" | "live">("idle");
  const vapiRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    fetch(`/api/embed/${agentId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Agent unavailable");
        setConfig(data);
      })
      .catch((e) => setError((e as Error).message));
    return () => vapiRef.current?.stop();
  }, [agentId]);

  async function start() {
    if (!config?.publicKey || !config.assistantId) {
      setError("This agent isn't ready for web calls yet.");
      return;
    }
    setState("connecting");
    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(config.publicKey);
      vapiRef.current = vapi;
      vapi.on("call-start", () => setState("live"));
      vapi.on("call-end", () => setState("idle"));
      vapi.on("error", () => {
        setState("idle");
        setError("The call could not be started. Please try again.");
      });
      await vapi.start(config.assistantId);
    } catch {
      setState("idle");
      setError("Voice calls aren't supported in this browser.");
    }
  }

  function stop() {
    vapiRef.current?.stop();
    setState("idle");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-4">
      <div className="w-full max-w-xs rounded-2xl border border-[#E8E8E8] bg-white p-5 text-center shadow-lg">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !config ? (
          <p className="text-sm text-[#64748B]">Loading…</p>
        ) : (
          <>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#301C3F] text-lg font-bold text-white">
              {config.name[0]?.toUpperCase()}
            </span>
            <h1 className="mt-3 text-base font-bold text-[#020817]">{config.name}</h1>
            <p className="mt-0.5 text-xs text-[#64748B]">{config.role}</p>
            {state === "idle" ? (
              <button
                onClick={start}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#301C3F] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                <Mic className="h-4 w-4" /> Talk to {config.name}
              </button>
            ) : (
              <button
                onClick={stop}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white"
              >
                <PhoneOff className="h-4 w-4" />
                {state === "connecting" ? "Connecting…" : "End call"}
              </button>
            )}
            {state === "live" && (
              <p className="mt-2 flex items-center justify-center gap-2 text-xs text-emerald-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live — speak now
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
