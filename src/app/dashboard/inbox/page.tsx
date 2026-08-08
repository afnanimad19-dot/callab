import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAgents } from "@/lib/db";
import InboxPanel from "@/components/dashboard/InboxPanel";

export const metadata = { title: "Inbox — VoiceLine AI" };

export default async function InboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const agents = await listAgents(session.userId);
  return <InboxPanel agents={agents} />;
}
