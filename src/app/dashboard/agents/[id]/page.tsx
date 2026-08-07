import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { findAgent } from "@/lib/db";
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
  const agent = await findAgent(session.userId, id);
  if (!agent) notFound();

  return (
    <AgentEditor
      agent={agent}
      agentType={agent.agentType ?? "single_prompt"}
    />
  );
}
