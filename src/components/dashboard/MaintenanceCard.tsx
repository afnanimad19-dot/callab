"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast, toastError } from "@/components/Toast";

// Operational tools shown at the bottom of Integrations:
//  - Re-sync agents: re-push every assistant to Vapi so its webhook + tool
//    URLs point at the CURRENT domain (run this after changing the domain).
//  - Clear sample data: wipe calls/campaigns/contacts so the dashboard shows
//    only real activity.
export default function MaintenanceCard() {
  const router = useRouter();
  const [resyncing, setResyncing] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function resync() {
    setResyncing(true);
    const res = await fetch("/api/vapi/resync", { method: "POST" });
    setResyncing(false);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(`Re-synced ${data.synced}/${data.total} agent${data.total === 1 ? "" : "s"} to the current domain.`);
      if (data.failures?.length) toastError(`Some agents failed: ${data.failures[0]}`);
    } else {
      const data = await res.json().catch(() => ({}));
      toastError(data.error ?? "Re-sync failed.");
    }
  }

  async function clearData() {
    if (!confirm("Clear ALL calls, campaigns and contacts for this workspace? Agents, phone numbers and knowledge bases are kept. This can't be undone.")) return;
    setClearing(true);
    const res = await fetch("/api/account/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    setClearing(false);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const c = data.counts ?? {};
      toast(`Cleared ${c.calls ?? 0} calls, ${c.campaigns ?? 0} campaigns and ${c.contacts ?? 0} contacts.`);
      router.refresh();
    } else {
      toastError("Could not clear the data.");
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold">Maintenance</h2>
      <p className="text-sm text-ink-400">Housekeeping tools for this workspace.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h3 className="text-sm font-semibold">Re-sync agents</h3>
          <p className="mt-1.5 text-sm text-ink-400">
            Re-pushes every agent so its call webhook and tool URLs point at this site&apos;s
            current domain. Run this after changing your domain.
          </p>
          <button onClick={resync} disabled={resyncing}
            className="btn-secondary mt-3 flex items-center gap-1.5 !text-sm disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${resyncing ? "animate-spin" : ""}`} /> {resyncing ? "Re-syncing…" : "Re-sync agents"}
          </button>
        </div>
        <div className="card border-signal-red/30">
          <h3 className="text-sm font-semibold">Clear sample data</h3>
          <p className="mt-1.5 text-sm text-ink-400">
            Deletes all calls, campaigns and contacts so the dashboard shows only real
            activity. Agents, numbers and knowledge bases are kept.
          </p>
          <button onClick={clearData} disabled={clearing}
            className="mt-3 flex items-center gap-1.5 rounded-lg border border-signal-red/50 px-3.5 py-2 text-sm font-semibold text-signal-red transition hover:bg-signal-red/10 disabled:opacity-60">
            <Trash2 className="h-4 w-4" /> {clearing ? "Clearing…" : "Clear activity data"}
          </button>
        </div>
      </div>
    </div>
  );
}
