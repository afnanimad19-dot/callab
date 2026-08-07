import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listKnowledgeBases } from "@/lib/db";
import KnowledgePanel from "@/components/dashboard/KnowledgePanel";

export const metadata = { title: "Knowledge Base — VoiceLine AI" };

export default async function KnowledgePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const items = await listKnowledgeBases(session.userId);
  return <KnowledgePanel items={items} />;
}
