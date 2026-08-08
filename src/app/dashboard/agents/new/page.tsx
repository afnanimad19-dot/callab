import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listKnowledgeBases } from "@/lib/db";
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
  const knowledgeBases = await listKnowledgeBases(session.userId);

  return (
    <AgentEditor
      agentType={agentType}
      knowledgeBases={knowledgeBases.map((k) => ({
        id: k.id,
        name: k.name,
        type: k.type ?? "text",
      }))}
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
