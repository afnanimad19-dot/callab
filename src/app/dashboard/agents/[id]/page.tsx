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
  const agent = await findAgent(session.userId, id);
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
            className={
              agent.status === "active"
                ? "badge-ok"
                : agent.status === "paused"
                  ? "badge-warn"
                  : "badge-muted"
            }
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
