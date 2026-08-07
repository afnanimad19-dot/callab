import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AgentEditor from "@/components/dashboard/AgentEditor";
import { TEMPLATE_CONTENT } from "@/lib/agent-templates";

export const metadata = { title: "New Agent — VoiceLine AI" };

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; template?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { type, template } = await searchParams;
  const agentType = type === "conversation_flow" ? "conversation_flow" : "single_prompt";
  const content = TEMPLATE_CONTENT[template ?? "scratch"] ?? TEMPLATE_CONTENT.scratch;

  return (
    <AgentEditor
      agentType={agentType}
      agent={{
        name:
          template && template !== "scratch"
            ? content.name
            : agentType === "conversation_flow"
              ? "New Conversation Flow"
              : "New Single Prompt Agent",
        role: content.role,
        identity: content.identity,
        tasks: content.tasks,
        guardrails: content.guardrails,
        greeting: content.greeting,
        outcomes: content.outcomes,
      }}
    />
  );
}
