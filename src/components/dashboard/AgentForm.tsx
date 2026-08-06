"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@/lib/db";

const VOICES = [
  "Nova (female, warm)",
  "Atlas (male, calm)",
  "Sage (female, professional)",
  "Orion (male, energetic)",
];

const LANGUAGES = ["English (US)", "English (UK)", "Spanish", "French", "German", "Arabic"];

export default function AgentForm({ agent }: { agent?: Agent }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    const res = await fetch(agent ? `/api/agents/${agent.id}` : "/api/agents", {
      method: agent ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/agents/${data.agent.id}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!agent) return;
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard/agents");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Agent name</label>
          <input id="name" name="name" className="field" defaultValue={agent?.name} placeholder="Front Desk" required />
        </div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <input id="role" name="role" className="field" defaultValue={agent?.role} placeholder="Inbound reception & scheduling" />
        </div>
        <div>
          <label className="label" htmlFor="voice">Voice</label>
          <select id="voice" name="voice" className="field" defaultValue={agent?.voice ?? VOICES[0]}>
            {VOICES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="language">Language</label>
          <select id="language" name="language" className="field" defaultValue={agent?.language ?? LANGUAGES[0]}>
            {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="phoneNumber">Phone number</label>
          <input
            id="phoneNumber"
            name="phoneNumber"
            className="field"
            defaultValue={agent?.phoneNumber === "Not assigned" ? "" : agent?.phoneNumber}
            placeholder="+1 (415) 555-0100 — assigned when telephony is connected"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="greeting">Greeting</label>
        <input
          id="greeting"
          name="greeting"
          className="field"
          defaultValue={agent?.greeting}
          placeholder="Thanks for calling — how can I help you today?"
        />
      </div>

      <div>
        <label className="label" htmlFor="systemPrompt">Instructions</label>
        <textarea
          id="systemPrompt"
          name="systemPrompt"
          rows={7}
          className="field font-mono !text-[13px] leading-relaxed"
          defaultValue={agent?.systemPrompt}
          placeholder={
            "Describe what this agent should do, what it knows, and when to escalate.\n\nExample: You are the front-desk assistant. Answer questions about hours and services. Book and reschedule appointments. If the caller is upset or asks for a human, escalate to a supervisor immediately."
          }
        />
        <p className="mt-1.5 text-xs text-ink-500">
          These instructions become the agent&apos;s system prompt when the voice pipeline runs.
        </p>
      </div>

      {agent && (
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="field sm:max-w-xs" defaultValue={agent.status}>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="draft">draft</option>
          </select>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
          {busy ? "Saving…" : agent ? "Save changes" : "Create agent"}
        </button>
        {agent && (
          <button
            type="button"
            onClick={onDelete}
            className="text-sm font-medium text-ink-400 hover:text-signal-red"
          >
            Delete agent
          </button>
        )}
      </div>
    </form>
  );
}
