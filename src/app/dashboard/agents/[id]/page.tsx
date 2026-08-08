import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { findAgent, listKnowledgeBases } from "@/lib/db";
import AgentEditor from "@/components/dashboard/AgentEditor";

export const metadata = { title: "Edit Agent — VoiceLine AI" };

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [agent, knowledgeBases] = await Promise.all([
    findAgent(session.userId, id),
    listKnowledgeBases(session.userId),
  ]);
  if (!agent) notFound();

  return (
    <AgentEditor
      agent={agent}
      agentType={agent.agentType ?? "single_prompt"}
      knowledgeBases={knowledgeBases.map((k) => ({
        id: k.id,
        name: k.name,
        type: k.type ?? "text",
      }))}
    />
  );
}
