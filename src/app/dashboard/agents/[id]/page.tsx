import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { findAgent } from "@/lib/db";
import AgentForm from "@/components/dashboard/AgentForm";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const agent = findAgent(session.userId, id);
  if (!agent) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/agents" className="text-xs font-medium text-ink-400 hover:text-ink-200">
          ← Back to agents
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              agent.status === "active"
                ? "bg-accent-500/15 text-accent-400"
                : agent.status === "paused"
                  ? "bg-signal-amber/15 text-signal-amber"
                  : "bg-ink-600/40 text-ink-300"
            }`}
          >
            {agent.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-400">{agent.role}</p>
      </div>
      <div className="card !p-7">
        <AgentForm agent={agent} />
      </div>
    </div>
  );
}
