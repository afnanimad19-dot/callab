import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAgents } from "@/lib/db";

export default async function AgentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const agents = await listAgents(session.userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Agents</h1>
          <p className="mt-1 text-sm text-ink-400">
            Each agent has its own voice, instructions, and phone number.
          </p>
        </div>
        <Link href="/dashboard/agents/new" className="btn-primary">
          + New agent
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {agents.map((a) => (
          <Link key={a.id} href={`/dashboard/agents/${a.id}`} className="card transition hover:border-ink-500">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold">{a.name}</h2>
                <p className="mt-0.5 text-sm text-ink-400">{a.role}</p>
              </div>
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
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-400">Voice</dt>
                <dd>{a.voice}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-400">Language</dt>
                <dd>{a.language}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-400">Phone number</dt>
                <dd className="font-mono text-[13px]">{a.phoneNumber}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="card py-10 text-center">
          <p className="text-sm text-ink-400">
            No agents yet — create your first one in under a minute.
          </p>
        </div>
      )}
    </div>
  );
}
