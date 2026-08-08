import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { findAgent, listKnowledgeBases, listPhoneNumbers } from "@/lib/db";
import FlowDesigner from "@/components/flow/FlowDesigner";

export const metadata = { title: "Flow Designer — VoiceLine AI" };

export default async function FlowDesignerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [agent, knowledgeBases, phoneNumbers] = await Promise.all([
    findAgent(session.userId, id),
    listKnowledgeBases(session.userId),
    listPhoneNumbers(session.userId),
  ]);
  if (!agent) notFound();

  return (
    <FlowDesigner agent={agent} knowledgeBases={knowledgeBases} phoneNumbers={phoneNumbers} />
  );
}
