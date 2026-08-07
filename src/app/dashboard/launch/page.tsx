import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  listAgents,
  listCampaigns,
  listContacts,
  listPhoneNumbers,
  listWebhooks,
} from "@/lib/db";
import CampaignsPanel from "@/components/dashboard/CampaignsPanel";
import CampaignWizard from "@/components/dashboard/CampaignWizard";

export const metadata = { title: "Launch your AI — VoiceLine AI" };

export default async function LaunchPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [campaigns, agents, phoneNumbers, webhooks, contacts] = await Promise.all([
    listCampaigns(session.userId),
    listAgents(session.userId),
    listPhoneNumbers(session.userId),
    listWebhooks(session.userId),
    listContacts(session.userId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-ink-400">
            Create and manage your calling campaigns
          </p>
        </div>
        <CampaignWizard
          agents={agents}
          phoneNumbers={phoneNumbers}
          webhooks={webhooks}
          contacts={contacts}
        />
      </div>
      <CampaignsPanel campaigns={campaigns} agents={agents} phoneNumbers={phoneNumbers} />
    </div>
  );
}
