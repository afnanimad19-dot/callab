import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAgents, listCampaigns } from "@/lib/db";
import CampaignPanel from "@/components/dashboard/CampaignPanel";

export const metadata = { title: "Launch your AI — VoiceLine AI" };

export default async function LaunchPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [campaigns, agents] = await Promise.all([
    listCampaigns(session.userId),
    listAgents(session.userId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Launch your AI</h1>
        <p className="mt-1 text-sm text-ink-400">
          Outbound campaigns: pick an agent, a goal, and a contact list — the AI
          makes the calls. (Calls dial for real once Vapi is connected in
          Integrations.)
        </p>
      </div>
      <CampaignPanel
        campaigns={campaigns.sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
        agents={agents}
      />
    </div>
  );
}
