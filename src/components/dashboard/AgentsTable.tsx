"use client";
import { Search, RefreshCw, Pencil, FlaskConical, Trash2 } from "lucide-react";

// Agents list: search, filter-by-status, refresh, and per-row actions menu.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@/lib/db";
import TestAgentPanel from "./TestAgentPanel";
import RowMenu from "./RowMenu";
import { toast } from "@/components/Toast";

const TYPE_LABEL: Record<string, string> = {
  single_prompt: "Single Prompt",
  conversation_flow: "Conversation Flow",
};

export default function AgentsTable({ agents }: { agents: Agent[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [testAgentId, setTestAgentId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (q && !a.name.toLowerCase().includes(q) && !a.role.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [agents, query, status]);

  async function remove(agent: Agent) {
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    toast(`Agent "${agent.name}" deleted.`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Search / filter bar */}
      <div className="card flex flex-wrap items-center gap-3 !p-4">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents..."
            className="field !pl-10"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="field w-44 !py-2.5"
        >
          <option value="all">Filter by status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="draft">Draft</option>
        </select>
        <button
          onClick={() => router.refresh()}
          aria-label="Refresh"
          className="btn-secondary !px-3.5 !py-2.5"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Language</th>
              <th className="px-5 py-3 font-medium">Voice</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {filtered.map((a) => (
              <tr
                key={a.id}
                className="cursor-pointer transition hover:bg-ink-800/60"
                onClick={() => router.push(`/dashboard/agents/${a.id}`)}
              >
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-3">
                    <span className="grad-bg flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white">
                      {a.name[0]?.toUpperCase()}
                    </span>
                    <span className="font-medium">{a.name}</span>
                    <span className="badge-muted">v{a.version ?? 1}</span>
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="badge-muted">
                    {TYPE_LABEL[a.agentType ?? "single_prompt"]}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="badge-muted">{a.language}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="badge-muted">{a.voice.split(" ")[0]}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={
                      a.status === "active"
                        ? "badge-ok"
                        : a.status === "paused"
                          ? "badge-warn"
                          : "badge-muted"
                    }
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <RowMenu
                    items={[
                      { label: "Edit", icon: Pencil, onClick: () => router.push(`/dashboard/agents/${a.id}`) },
                      { label: "Test agent", icon: FlaskConical, onClick: () => setTestAgentId(a.id) },
                      { label: "Delete", icon: Trash2, danger: true, onClick: () => remove(a) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-ink-400">
            {agents.length === 0
              ? "No agents yet — create your first one."
              : "No agents match your search."}
          </p>
        )}
      </div>

      {testAgentId && (
        <TestAgentPanel
          agents={agents}
          initialAgentId={testAgentId}
          onClose={() => setTestAgentId(null)}
        />
      )}
    </div>
  );
}
