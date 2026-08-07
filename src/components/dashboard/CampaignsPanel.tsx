"use client";

// Campaigns list: stat cards, search/filter, and rich campaign cards with
// schedule / contacts / agent / phone-number panels and lifecycle actions.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign } from "@/lib/db";

const STATUS_BADGE: Record<Campaign["status"], string> = {
  running: "badge-ok",
  scheduled: "badge-warn",
  paused: "badge-warn",
  stopped: "badge-bad",
  completed: "badge-muted",
  draft: "badge-muted",
  archived: "badge-muted",
};

function InfoBox({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span>{icon}</span> {title}
      </p>
      <div className="mt-2 space-y-1 text-sm text-ink-300">{children}</div>
    </div>
  );
}

export default function CampaignsPanel({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns
      .filter((c) => c.status !== "archived")
      .filter((c) => statusFilter === "all" || c.status === statusFilter)
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [campaigns, query, statusFilter]);

  const stats = useMemo(() => {
    const active = campaigns.filter((c) => c.status !== "archived");
    return [
      { label: "Total Campaigns", value: active.length, sub: "All campaigns", icon: "🗒" },
      { label: "Running", value: active.filter((c) => c.status === "running").length, sub: "Currently active campaigns", icon: "▶" },
      { label: "Scheduled", value: active.filter((c) => c.status === "scheduled").length, sub: "Campaigns scheduled to start", icon: "🗓" },
      { label: "Completed", value: active.filter((c) => c.status === "completed").length, sub: "Successfully completed campaigns", icon: "✓" },
    ];
  }, [campaigns]);

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
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-ink-300">{s.label}</p>
              <span className="text-ink-400">{s.icon}</span>
            </div>
            <p className="mt-1.5 text-3xl font-bold">{s.value}</p>
            <p className="mt-0.5 text-xs text-ink-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Search / filter */}
      <div className="card flex flex-wrap items-center gap-3 !p-4">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">🔍</span>
          <input className="field !pl-10" placeholder="Search campaigns..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="field w-44 !py-2.5" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Filter by status</option>
          <option value="running">Running</option>
          <option value="scheduled">Scheduled</option>
          <option value="paused">Paused</option>
          <option value="stopped">Stopped</option>
          <option value="completed">Completed</option>
        </select>
        <button onClick={() => router.refresh()} aria-label="Refresh" className="btn-secondary !px-3.5 !py-2.5">⟳</button>
      </div>

      {/* Campaign cards */}
      {visible.map((c) => {
        const isOutbound = (c.direction ?? "outbound") === "outbound";
        return (
          <div key={c.id} className="card !p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold">{c.name}</h2>
                <span className={STATUS_BADGE[c.status]}>{c.status}</span>
                <span className={isOutbound ? "badge-warn" : "badge-ok"}>
                  {isOutbound ? "📲 outbound" : "📞 inbound"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setStatus(c.id, "archived")} className="btn-secondary !px-3.5 !py-1.5 !text-xs">
                  🗄 Archive
                </button>
                {c.status === "running" && (
                  <button onClick={() => setStatus(c.id, "paused")} className="btn-secondary !px-3.5 !py-1.5 !text-xs !text-signal-amber">
                    ⏸ Pause
                  </button>
                )}
                {(c.status === "paused" || c.status === "stopped") && (
                  <button onClick={() => setStatus(c.id, "running")} className="btn-secondary !px-3.5 !py-1.5 !text-xs !text-accent-300">
                    ▶ Resume
                  </button>
                )}
                {c.status === "running" && (
                  <button onClick={() => setStatus(c.id, "stopped")} className="btn-secondary !px-3.5 !py-1.5 !text-xs !text-signal-red">
                    ⏹ Stop
                  </button>
                )}
                {c.status !== "completed" && (
                  <button onClick={() => setStatus(c.id, "completed")} className="btn-secondary !px-3.5 !py-1.5 !text-xs">
                    ✓ Complete
                  </button>
                )}
              </div>
            </div>

            {c.goal && <p className="mt-2 text-sm text-ink-300">{c.goal}</p>}

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {isOutbound && c.schedule && (
                <InfoBox icon="🗓" title="Schedule">
                  <p>
                    {c.schedule.startDate} — {c.schedule.endDate || "Ongoing"}
                  </p>
                  <p className="text-xs">
                    🕐 {c.schedule.from} – {c.schedule.to} <span className="text-ink-500">({c.schedule.timezone})</span>
                  </p>
                  <p className="text-xs text-ink-400">{c.schedule.days.join(", ")}</p>
                </InfoBox>
              )}
              {isOutbound && (
                <InfoBox icon="👥" title="Contacts">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs">
                    Tags:
                    {(c.filters?.tags?.length ? c.filters.tags : ["all"]).map((t) => (
                      <span key={t} className="badge-warn">{t}</span>
                    ))}
                  </p>
                  <p className="text-xs text-ink-400">
                    {c.contactsCalled} of {c.contactsTotal} called
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-800">
                    <div
                      className="grad-bg h-full rounded-full"
                      style={{ width: `${c.contactsTotal ? Math.round((c.contactsCalled / c.contactsTotal) * 100) : 0}%` }}
                    />
                  </div>
                </InfoBox>
              )}
              <InfoBox icon="🤖" title="AI Agent">
                <p>{c.agentName}</p>
              </InfoBox>
              <InfoBox icon="📱" title="Phone Number">
                <p className="font-mono text-[13px]">{c.phoneNumber || "No number assigned"}</p>
              </InfoBox>
            </div>

            <p className="mt-3 text-xs text-ink-500">
              Created {new Date(c.createdAt).toLocaleDateString()} · Updated{" "}
              {new Date(c.updatedAt ?? c.createdAt).toLocaleDateString()}
            </p>
          </div>
        );
      })}

      {visible.length === 0 && (
        <div className="card py-12 text-center text-sm text-ink-400">
          {campaigns.length === 0
            ? "No campaigns yet — create one to start calling."
            : "No campaigns match your search."}
        </div>
      )}
      {visible.length > 0 && (
        <p className="pb-2 text-center text-xs text-ink-500">You&apos;ve reached the end of the list.</p>
      )}
    </div>
  );
}
