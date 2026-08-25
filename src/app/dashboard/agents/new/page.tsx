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
  const knowledgeBases = await listKnowledgeBases(session.userId);

  // "Start from scratch" means exactly that: a blank agent. Only an explicitly
  // chosen template prefills the identity/tasks/guardrails.
  const isTemplate = Boolean(template && template !== "scratch" && TEMPLATE_CONTENT[template]);
  const content = isTemplate ? TEMPLATE_CONTENT[template!] : null;

  return (
    <AgentEditor
      agentType={agentType}
      knowledgeBases={knowledgeBases.map((k) => ({
        id: k.id,
        name: k.name,
        type: k.type ?? "text",
      }))}
      agent={
        content
          ? {
              name: content.name,
              role: content.role,
              identity: content.identity,
              tasks: content.tasks,
              guardrails: content.guardrails,
              greeting: content.greeting,
              outcomes: content.outcomes,
            }
          : {
              name: agentType === "conversation_flow" ? "New Conversation Flow" : "New Single Prompt Agent",
              role: "",
              identity: "",
              tasks: "",
              guardrails: "",
              greeting: "",
              outcomes: [],
            }
      }
    />
  );
}
