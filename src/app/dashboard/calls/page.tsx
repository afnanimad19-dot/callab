import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAgents, listCalls, listCampaigns } from "@/lib/db";
import CallLogsTable from "@/components/dashboard/CallLogsTable";

export const metadata = { title: "Call Logs — VoiceLine AI" };

export default async function CallLogsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [calls, campaigns, agents] = await Promise.all([
    listCalls(session.userId),
    listCampaigns(session.userId),
    listAgents(session.userId),
  ]);

  const agentNumbers = Object.fromEntries(
    agents.map((a) => [a.id, a.phoneNumber])
  );

  return (
    <CallLogsTable calls={calls} campaigns={campaigns} agentNumbers={agentNumbers} />
  );
}
