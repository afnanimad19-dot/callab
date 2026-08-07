import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAgents } from "@/lib/db";
import AgentsTable from "@/components/dashboard/AgentsTable";
import CreateAgentFlow from "@/components/dashboard/CreateAgentFlow";
import TestAgentButton from "@/components/dashboard/TestAgentButton";

export const metadata = { title: "AI Agents — VoiceLine AI" };

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
            Manage your AI voice agents for calls and campaigns
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TestAgentButton agents={agents} />
          <CreateAgentFlow />
        </div>
      </div>
      <AgentsTable agents={agents} />
    </div>
  );
}
