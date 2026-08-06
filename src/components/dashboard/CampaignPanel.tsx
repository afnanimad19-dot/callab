"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent, Campaign } from "@/lib/db";

const STATUS_BADGE: Record<Campaign["status"], string> = {
  running: "badge-ok",
  draft: "badge-muted",
  paused: "badge-warn",
  completed: "badge-muted",
};

export default function CampaignPanel({
  campaigns,
  agents,
}: {
  campaigns: Campaign[];
  agents: Agent[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createCampaign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowForm(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  async function setStatus(id: string, status: Campaign["status"]) {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          {showForm ? "Cancel" : "+ New campaign"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createCampaign} className="card space-y-4 !p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Campaign name</label>
              <input id="name" name="name" className="field" placeholder="Quote follow-ups — September" required />
            </div>
            <div>
              <label className="label" htmlFor="agentId">Agent</label>
              <select id="agentId" name="agentId" className="field" required>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="goal">Goal</label>
            <textarea
              id="goal"
              name="goal"
              rows={3}
              className="field"
              placeholder="Call every lead who requested a quote in the last 30 days and book a demo."
            />
          </div>
          {error && (
            <p className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3.5 py-2.5 text-sm text-signal-red">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? "Creating…" : "Create campaign"}
          </button>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {campaigns.map((c) => {
          const progress = c.contactsTotal
            ? Math.round((c.contactsCalled / c.contactsTotal) * 100)
            : 0;
          return (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{c.name}</h2>
                  <p className="mt-0.5 text-xs text-ink-400">Agent: {c.agentName}</p>
                </div>
                <span className={STATUS_BADGE[c.status]}>{c.status}</span>
              </div>
              {c.goal && (
                <p className="mt-3 text-sm leading-relaxed text-ink-300">{c.goal}</p>
              )}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-ink-400">
                  <span>{c.contactsCalled} of {c.contactsTotal} contacts called</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full bg-accent-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {c.status !== "running" && c.status !== "completed" && (
                  <button onClick={() => setStatus(c.id, "running")} className="btn-primary !px-4 !py-1.5 !text-xs">
                    ▶ Launch
                  </button>
                )}
                {c.status === "running" && (
                  <button onClick={() => setStatus(c.id, "paused")} className="btn-secondary !px-4 !py-1.5 !text-xs">
                    ⏸ Pause
                  </button>
                )}
                {c.status !== "completed" && (
                  <button onClick={() => setStatus(c.id, "completed")} className="btn-secondary !px-4 !py-1.5 !text-xs">
                    Mark complete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {campaigns.length === 0 && !showForm && (
        <div className="card py-10 text-center text-sm text-ink-400">
          No campaigns yet — create one to start outbound calling.
        </div>
      )}
    </div>
  );
}
