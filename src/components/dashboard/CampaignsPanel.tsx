"use client";
import {
  Search,
  RefreshCw,
  Eye,
  Pencil,
  Play,
  Pause,
  Archive,
  ClipboardList,
  Calendar,
  CheckCircle2,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Users,
  Bot,
  Smartphone,
  Square,
  Check,
} from "lucide-react";

// Campaigns list: stat cards, search/filter, and rich campaign cards with
// schedule / contacts / agent / phone-number panels and lifecycle actions.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent, Campaign, PhoneNumber } from "@/lib/db";
import Modal from "@/components/Modal";
import RowMenu from "./RowMenu";
import { toast } from "@/components/Toast";

const STATUS_BADGE: Record<Campaign["status"], string> = {
  running: "badge-ok",
  scheduled: "badge-warn",
  paused: "badge-warn",
  stopped: "badge-bad",
  completed: "badge-muted",
  draft: "badge-muted",
  archived: "badge-muted",
};

function InfoBox({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </p>
      <div className="mt-2 space-y-1 text-sm text-ink-300">{children}</div>
    </div>
  );
}

export default function CampaignsPanel({
  campaigns,
  agents = [],
  phoneNumbers = [],
}: {
  campaigns: Campaign[];
  agents?: Agent[];
  phoneNumbers?: PhoneNumber[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [details, setDetails] = useState<Campaign | null>(null);

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
      { label: "Total Campaigns", value: active.length, sub: "All campaigns", icon: ClipboardList },
      { label: "Running", value: active.filter((c) => c.status === "running").length, sub: "Currently active campaigns", icon: Play },
      { label: "Scheduled", value: active.filter((c) => c.status === "scheduled").length, sub: "Campaigns scheduled to start", icon: Calendar },
      { label: "Completed", value: active.filter((c) => c.status === "completed").length, sub: "Successfully completed campaigns", icon: CheckCircle2 },
    ];
  }, [campaigns]);

  async function setStatus(id: string, status: Campaign["status"]) {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    toast(`Campaign ${status === "running" ? "resumed" : status}.`);
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
              <s.icon className="h-4 w-4 text-ink-400" />
            </div>
            <p className="mt-1.5 text-3xl font-bold">{s.value}</p>
            <p className="mt-0.5 text-xs text-ink-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Search / filter */}
      <div className="card flex flex-wrap items-center gap-3 !p-4">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"><Search className="h-4 w-4" /></span>
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
        <button onClick={() => router.refresh()} aria-label="Refresh" className="btn-secondary !px-3.5 !py-2.5"><RefreshCw className="h-4 w-4" /></button>
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
                <span className={`inline-flex items-center gap-1 ${isOutbound ? "badge-warn" : "badge-ok"}`}>
                  {isOutbound ? <PhoneOutgoing className="h-3 w-3" /> : <PhoneIncoming className="h-3 w-3" />}
                  {isOutbound ? "outbound" : "inbound"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setStatus(c.id, "archived")} className="btn-secondary flex items-center gap-1.5 !px-3.5 !py-1.5 !text-xs">
                  <Archive className="h-3 w-3" /> Archive
                </button>
                <RowMenu
                  items={[
                    { label: "View details", icon: Eye, onClick: () => setDetails(c) },
                    { label: "Edit", icon: Pencil, onClick: () => setEditing(c) },
                    ...(c.status === "running"
                      ? [{ label: "Pause", icon: Pause, onClick: () => setStatus(c.id, "paused") }]
                      : [{ label: "Resume", icon: Play, onClick: () => setStatus(c.id, "running") }]),
                    { label: "Archive", icon: Archive, danger: true, onClick: () => setStatus(c.id, "archived") },
                  ]}
                />
                {c.status === "running" && (
                  <button onClick={() => setStatus(c.id, "paused")} className="btn-secondary flex items-center gap-1.5 !px-3.5 !py-1.5 !text-xs !text-signal-amber">
                    <Pause className="h-3 w-3" /> Pause
                  </button>
                )}
                {(c.status === "paused" || c.status === "stopped") && (
                  <button onClick={() => setStatus(c.id, "running")} className="btn-secondary flex items-center gap-1.5 !px-3.5 !py-1.5 !text-xs !text-accent-300">
                    <Play className="h-3 w-3" /> Resume
                  </button>
                )}
                {c.status === "running" && (
                  <button onClick={() => setStatus(c.id, "stopped")} className="btn-secondary flex items-center gap-1.5 !px-3.5 !py-1.5 !text-xs !text-signal-red">
                    <Square className="h-3 w-3" /> Stop
                  </button>
                )}
                {c.status !== "completed" && (
                  <button onClick={() => setStatus(c.id, "completed")} className="btn-secondary flex items-center gap-1.5 !px-3.5 !py-1.5 !text-xs">
                    <Check className="h-3 w-3" /> Complete
                  </button>
                )}
              </div>
            </div>

            {c.goal && <p className="mt-2 text-sm text-ink-300">{c.goal}</p>}

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {isOutbound && c.schedule && (
                <InfoBox icon={<Calendar className="h-4 w-4 text-ink-400" />} title="Schedule">
                  <p>
                    {c.schedule.startDate} — {c.schedule.endDate || "Ongoing"}
                  </p>
                  <p className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" /> {c.schedule.from} – {c.schedule.to} <span className="text-ink-500">({c.schedule.timezone})</span>
                  </p>
                  <p className="text-xs text-ink-400">{c.schedule.days.join(", ")}</p>
                </InfoBox>
              )}
              {isOutbound && (
                <InfoBox icon={<Users className="h-4 w-4 text-ink-400" />} title="Contacts">
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
              <InfoBox icon={<Bot className="h-4 w-4 text-ink-400" />} title="AI Agent">
                <p>{c.agentName}</p>
              </InfoBox>
              <InfoBox icon={<Smartphone className="h-4 w-4 text-ink-400" />} title="Phone Number">
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
        <div className="card flex flex-col items-center py-12 text-center text-sm text-ink-400">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/empty-state.webp" alt="" className="mb-4 h-28 w-28" />
          {campaigns.length === 0
            ? "No campaigns yet — create one to start calling."
            : "No campaigns match your search."}
        </div>
      )}
      {visible.length > 0 && (
        <p className="pb-2 text-center text-xs text-ink-500">You&apos;ve reached the end of the list.</p>
      )}

      {editing && (
        <EditCampaignModal
          campaign={editing}
          agents={agents}
          phoneNumbers={phoneNumbers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast("Campaign updated.");
            router.refresh();
          }}
        />
      )}
      {details && <CampaignDetailsModal campaign={details} onClose={() => setDetails(null)} />}
    </div>
  );
}

function EditCampaignModal({
  campaign,
  agents,
  phoneNumbers,
  onClose,
  onSaved,
}: {
  campaign: Campaign;
  agents: Agent[];
  phoneNumbers: PhoneNumber[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.goal ?? "");
  const [agentId, setAgentId] = useState(campaign.agentId);
  const [phoneNumber, setPhoneNumber] = useState(campaign.phoneNumber ?? "");
  const [startDate, setStartDate] = useState(campaign.schedule?.startDate ?? "");
  const [endDate, setEndDate] = useState(campaign.schedule?.endDate ?? "");
  const [from, setFrom] = useState(campaign.schedule?.from ?? "09:00");
  const [to, setTo] = useState(campaign.schedule?.to ?? "17:00");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        agentId,
        phoneNumber,
        schedule: { ...(campaign.schedule ?? {}), startDate, endDate, from, to },
      }),
    });
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Edit Campaign" wide>
      <div className="space-y-4">
        <div>
          <label className="label">Campaign name</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea rows={2} className="field" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">AI Agent</label>
            <select className="field" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Phone number</label>
            <select className="field" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}>
              <option value="">No number assigned</option>
              {phoneNumbers.map((p) => (
                <option key={p.id} value={p.number}>{p.number}</option>
              ))}
            </select>
          </div>
        </div>
        {(campaign.direction ?? "outbound") === "outbound" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Start date</label>
              <input type="date" className="field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label">End date (empty = ongoing)</label>
              <input type="date" className="field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Calling from</label>
              <input type="time" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Calling until</label>
              <input type="time" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={busy || !name.trim()} className="btn-primary disabled:opacity-60">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CampaignDetailsModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const rows: [string, string][] = [
    ["Status", campaign.status],
    ["Direction", campaign.direction ?? "outbound"],
    ["AI Agent", campaign.agentName],
    ["Phone number", campaign.phoneNumber || "No number assigned"],
    ["Contacts", `${campaign.contactsCalled} of ${campaign.contactsTotal} called`],
    ["Tags filter", campaign.filters?.tags?.length ? campaign.filters.tags.join(", ") : "All contacts"],
    [
      "Schedule",
      campaign.schedule
        ? `${campaign.schedule.startDate} — ${campaign.schedule.endDate || "Ongoing"} · ${campaign.schedule.from}–${campaign.schedule.to} (${campaign.schedule.timezone}) · ${campaign.schedule.days.join(", ")}`
        : "—",
    ],
    ["Webhook", campaign.webhookId || "None"],
    [
      "Variable mapping",
      campaign.variableMapping && Object.keys(campaign.variableMapping).length
        ? Object.entries(campaign.variableMapping).map(([k, v]) => `{{${k}}} → ${v}`).join(", ")
        : "None",
    ],
    ["Created", new Date(campaign.createdAt).toLocaleString()],
    ["Updated", new Date(campaign.updatedAt ?? campaign.createdAt).toLocaleString()],
  ];
  return (
    <Modal open onClose={onClose} title={campaign.name} wide>
      {campaign.goal && <p className="mb-4 text-sm text-ink-300">{campaign.goal}</p>}
      <div className="divide-y divide-ink-700/70 rounded-xl border border-ink-700">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-6 px-4 py-2.5 text-sm">
            <span className="shrink-0 text-ink-400">{label}</span>
            <span className="text-right font-medium capitalize">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="btn-secondary">Close</button>
      </div>
    </Modal>
  );
}
