"use client";
import { Search, RefreshCw, Play, Download, CloudDownload } from "lucide-react";
import { toast, toastError } from "@/components/Toast";

// Call Logs: searchable, filterable, paginated table with CSV export.
// Clicking a row (or its recording icon) opens the call detail page.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Call, Campaign } from "@/lib/db";

function fmtDuration(sec: number) {
  const whole = Math.round(sec || 0); // stored values can be fractional
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function statusOf(c: Call): { label: string; cls: string } {
  const r = c.endReason.toLowerCase();
  if (r.includes("busy")) return { label: "busy", cls: "badge-warn" };
  if (c.outcome === "voicemail") return { label: "voicemail", cls: "badge-muted" };
  if (c.outcome === "escalated") return { label: "escalated", cls: "badge-bad" };
  return { label: "ended", cls: "badge-ok" };
}

export default function CallLogsTable({
  calls,
  campaigns,
  agentNumbers,
}: {
  calls: Call[];
  campaigns: Campaign[];
  agentNumbers: Record<string, string>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [syncing, setSyncing] = useState(false);

  const campaignName = (id?: string) => campaigns.find((c) => c.id === id)?.name ?? "-";

  // Pull any calls Vapi has that aren't logged yet (recovers phone calls whose
  // end-of-call webhook was missed).
  async function syncFromVapi() {
    setSyncing(true);
    const res = await fetch("/api/calls/sync", { method: "POST" });
    setSyncing(false);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.imported > 0) {
        toast(`Recovered ${data.imported} call${data.imported === 1 ? "" : "s"} from the voice pipeline.`);
        router.refresh();
      } else {
        toast("Call Logs are already up to date.");
      }
    } else {
      const data = await res.json().catch(() => ({}));
      toastError(data.error ?? "Could not sync calls.");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calls.filter((c) => {
      if (status !== "all" && statusOf(c).label !== status) return false;
      if (campaign !== "all" && c.campaignId !== campaign) return false;
      if (q && !`${c.callerNumber} ${c.agentName} ${c.summary}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [calls, query, status, campaign]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * perPage, current * perPage);

  function exportCsv() {
    const header = "date,from,to,direction,duration,status,campaign,agent";
    const lines = filtered.map((c) => {
      const inbound = c.direction === "inbound";
      const agentNum = agentNumbers[c.agentId] ?? "";
      return [
        c.startedAt,
        inbound ? c.callerNumber : agentNum,
        inbound ? agentNum : c.callerNumber,
        inbound ? "incoming" : "outgoing",
        fmtDuration(c.durationSec),
        statusOf(c).label,
        campaignName(c.campaignId),
        c.agentName,
      ].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",");
    });
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "call-logs.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Call Logs</h1>
          <p className="mt-1 text-sm text-ink-400">View and manage your AI agent calls</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={syncFromVapi} disabled={syncing} className="btn-secondary flex items-center gap-1.5 disabled:opacity-60">
            <CloudDownload className="h-4 w-4" /> {syncing ? "Syncing…" : "Sync calls"}
          </button>
          <button onClick={exportCsv} className="btn-secondary flex items-center gap-1.5"><Download className="h-4 w-4" /> Export CSV</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card flex flex-wrap items-center gap-3 !p-4">
        <div className="relative min-w-[200px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"><Search className="h-4 w-4" /></span>
          <input className="field !pl-10" placeholder="Search..." value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        </div>
        <select className="field w-36 !py-2.5" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="all">All Statuses</option>
          <option value="ended">Ended</option>
          <option value="busy">Busy</option>
          <option value="escalated">Escalated</option>
          <option value="voicemail">Voicemail</option>
        </select>
        <select className="field w-44 !py-2.5" value={campaign} onChange={(e) => { setCampaign(e.target.value); setPage(1); }}>
          <option value="all">All Campaigns</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => router.refresh()} aria-label="Refresh" className="btn-secondary !px-3.5 !py-2.5"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium">To</th>
              <th className="px-4 py-3 font-medium">Direction</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Recording</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {rows.map((c) => {
              const inbound = c.direction === "inbound";
              const agentNum = agentNumbers[c.agentId] ?? "—";
              const s = statusOf(c);
              return (
                <tr key={c.id} className="cursor-pointer transition hover:bg-ink-800/60"
                  onClick={() => router.push(`/dashboard/calls/${c.id}`)}>
                  <td className="px-4 py-3 text-ink-300">
                    <span className="flex items-center gap-2">
                      {new Date(c.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      {c.isTest && <span className="badge-warn !text-[10px]">test</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px]">{inbound ? c.callerNumber : agentNum}</td>
                  <td className="px-4 py-3 font-mono text-[13px]">{inbound ? agentNum : c.callerNumber}</td>
                  <td className="px-4 py-3 text-ink-300">{inbound ? "incoming" : "outgoing"}</td>
                  <td className="px-4 py-3">{fmtDuration(c.durationSec)}</td>
                  <td className="px-4 py-3"><span className={s.cls}>{s.label}</span></td>
                  <td className="px-4 py-3 text-ink-300">{campaignName(c.campaignId)}</td>
                  <td className="px-4 py-3">{c.agentName}</td>
                  <td className="px-4 py-3 text-ink-400">{c.recordingUrl || c.vapiCallId ? (<span className="inline-flex items-center gap-1"><Play className="h-3.5 w-3.5" /> audio</span>) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-ink-400">No calls match your filters.</p>
        )}
        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 px-5 py-3 text-sm text-ink-400">
          <span>
            Showing {filtered.length === 0 ? 0 : (current - 1) * perPage + 1} to{" "}
            {Math.min(current * perPage, filtered.length)} of {filtered.length} calls
          </span>
          <div className="flex items-center gap-1.5">
            <button disabled={current === 1} onClick={() => setPage(current - 1)}
              className="btn-secondary !px-3 !py-1.5 !text-xs disabled:opacity-40">‹ Previous</button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${p === current ? "grad-bg text-white" : "text-ink-300 hover:bg-ink-800"}`}>
                {p}
              </button>
            ))}
            {pages > 5 && <span>… {pages}</span>}
            <button disabled={current === pages} onClick={() => setPage(current + 1)}
              className="btn-secondary !px-3 !py-1.5 !text-xs disabled:opacity-40">Next ›</button>
          </div>
          <label className="flex items-center gap-2 text-xs">
            Per Page:
            <select className="field !w-auto !py-1.5 !text-xs" value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
              {[15, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
