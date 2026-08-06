import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAgents, listCalls } from "@/lib/db";

function formatDuration(sec: number) {
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export default async function OverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const agents = listAgents(session.userId);
  const calls = listCalls(session.userId);

  const resolved = calls.filter((c) => c.outcome === "resolved").length;
  const escalated = calls.filter((c) => c.outcome === "escalated").length;
  const avgDuration = calls.length
    ? Math.round(calls.reduce((s, c) => s + c.durationSec, 0) / calls.length)
    : 0;
  const positive = calls.filter((c) => c.sentiment === "positive").length;

  const stats = [
    { label: "Calls (7 days)", value: String(calls.length) },
    {
      label: "Resolved by AI",
      value: calls.length ? `${Math.round((resolved / calls.length) * 100)}%` : "—",
    },
    { label: "Escalated to humans", value: String(escalated) },
    { label: "Avg. call duration", value: formatDuration(avgDuration) },
    {
      label: "Positive sentiment",
      value: calls.length ? `${Math.round((positive / calls.length) * 100)}%` : "—",
    },
    {
      label: "Active agents",
      value: String(agents.filter((a) => a.status === "active").length),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {session.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            Here&apos;s how {session.company}&apos;s voice agents are doing.
          </p>
        </div>
        <Link href="/dashboard/live" className="btn-primary">
          <span className="h-2 w-2 rounded-full bg-ink-950 animate-pulseDot" />
          Open live monitoring
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
              {s.label}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card !p-0">
          <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Recent calls</h2>
            <Link href="/dashboard/calls" className="text-xs font-medium text-accent-400 hover:text-accent-300">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-ink-700/70">
            {calls.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/calls/${c.id}`}
                className="flex items-center justify-between px-5 py-3 transition hover:bg-ink-800/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.agentName} · {c.callerNumber}
                  </p>
                  <p className="truncate text-xs text-ink-400">{c.summary}</p>
                </div>
                <span
                  className={`ml-4 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    c.outcome === "escalated"
                      ? "bg-signal-red/15 text-signal-red"
                      : "bg-accent-500/15 text-accent-400"
                  }`}
                >
                  {c.outcome.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card !p-0">
          <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Your agents</h2>
            <Link href="/dashboard/agents" className="text-xs font-medium text-accent-400 hover:text-accent-300">
              Manage →
            </Link>
          </div>
          <div className="divide-y divide-ink-700/70">
            {agents.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/agents/${a.id}`}
                className="flex items-center justify-between px-5 py-3 transition hover:bg-ink-800/50"
              >
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-ink-400">{a.role} · {a.phoneNumber}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    a.status === "active"
                      ? "bg-accent-500/15 text-accent-400"
                      : a.status === "paused"
                        ? "bg-signal-amber/15 text-signal-amber"
                        : "bg-ink-600/40 text-ink-300"
                  }`}
                >
                  {a.status}
                </span>
              </Link>
            ))}
            {agents.length === 0 && (
              <p className="px-5 py-6 text-sm text-ink-400">
                No agents yet.{" "}
                <Link href="/dashboard/agents/new" className="text-accent-400">
                  Create your first agent →
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
