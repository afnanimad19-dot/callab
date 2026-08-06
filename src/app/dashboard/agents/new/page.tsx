import Link from "next/link";
import AgentForm from "@/components/dashboard/AgentForm";

export default function NewAgentPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/agents" className="text-xs font-medium text-ink-400 hover:text-ink-200">
          ← Back to agents
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Create a new agent</h1>
        <p className="mt-1 text-sm text-ink-400">
          Configure how the agent greets callers, what it knows, and when it escalates.
        </p>
      </div>
      <div className="card !p-7">
        <AgentForm />
      </div>
    </div>
  );
}
