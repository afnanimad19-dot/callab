import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSession } from "@/lib/auth";
import {
  findUserById,
  listAgents,
  listCampaigns,
  listContacts,
  listPhoneNumbers,
  listWebhooks,
} from "@/lib/db";
import { planFeature, tierForFeature, getPlanTier } from "@/lib/plans";
import CampaignsPanel from "@/components/dashboard/CampaignsPanel";
import CampaignWizard from "@/components/dashboard/CampaignWizard";

export const metadata = { title: "Launch your AI — VoiceLine AI" };

export default async function LaunchPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [campaigns, agents, phoneNumbers, webhooks, contacts, user] = await Promise.all([
    listCampaigns(session.userId),
    listAgents(session.userId),
    listPhoneNumbers(session.userId),
    listWebhooks(session.userId),
    listContacts(session.userId),
    findUserById(session.userId),
  ]);

  // Outbound calling campaigns are a paid feature. Lower tiers see a lock and
  // an upgrade prompt instead of the campaign builder.
  const outboundAllowed = planFeature(user, "outbound");
  const needTier = tierForFeature("outbound");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-ink-400">
            Create and manage your outbound calling campaigns
          </p>
        </div>
        {outboundAllowed ? (
          <CampaignWizard
            agents={agents}
            phoneNumbers={phoneNumbers}
            webhooks={webhooks}
            contacts={contacts}
          />
        ) : (
          <Link href="/dashboard/plans" className="btn-secondary flex items-center gap-2 !text-sm">
            <Lock className="h-4 w-4" /> New campaign
          </Link>
        )}
      </div>

      {outboundAllowed ? (
        <CampaignsPanel campaigns={campaigns} agents={agents} phoneNumbers={phoneNumbers} />
      ) : (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-800 text-ink-400">
            <Lock className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold">Outbound campaigns are a premium feature</h2>
          <p className="max-w-md text-sm text-ink-400">
            Your {getPlanTier(user).name} plan includes inbound calls and chat. Upgrade to{" "}
            {needTier?.name ?? "a higher plan"} to run outbound calling campaigns to your contact lists.
          </p>
          <Link href="/dashboard/plans" className="btn-primary !text-sm">
            Upgrade to {needTier?.name ?? "unlock"}
          </Link>
        </div>
      )}
    </div>
  );
}
