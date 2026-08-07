"use client";
import { Search, RefreshCw, MoreVertical, Pencil, FlaskConical, Trash2 } from "lucide-react";

// Agents list: search, filter-by-status, refresh, and per-row actions menu.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@/lib/db";
import TestAgentPanel from "./TestAgentPanel";

const TYPE_LABEL: Record<string, string> = {
  single_prompt: "Single Prompt",
  conversation_flow: "Conversation Flow",
};

export default function AgentsTable({ agents }: { agents: Agent[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [menuFor, setMenuFor] = useState<string | null>(null);
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
    setMenuFor(null);
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5" onClick={() => menuFor && setMenuFor(null)}>
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
                <td
                  className="relative px-5 py-3.5 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setMenuFor(menuFor === a.id ? null : a.id)}
                    aria-label="Actions"
                    className="rounded-lg px-2.5 py-1 text-lg leading-none text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuFor === a.id && (
                    <div className="absolute right-4 top-11 z-20 w-40 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 py-1 text-left shadow-xl shadow-black/30">
                      <button
                        onClick={() => router.push(`/dashboard/agents/${a.id}`)}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-ink-200 transition hover:bg-ink-800"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => {
                          setMenuFor(null);
                          setTestAgentId(a.id);
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-ink-200 transition hover:bg-ink-800"
                      >
                        <FlaskConical className="h-3.5 w-3.5" /> Test agent
                      </button>
                      <button
                        onClick={() => remove(a)}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-signal-red transition hover:bg-ink-800"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  )}
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
