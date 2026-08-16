import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { findDataOwner, listAgents } from "@/lib/db";
import { PLAN_TIERS, getPlanTier } from "@/lib/plans";
import PlansPanel from "@/components/dashboard/PlansPanel";

export const metadata = { title: "Plans — VoiceLine AI" };

export default async function PlansPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await findDataOwner(session.userId);
  const agentsUsed = (await listAgents(session.userId)).length;

  return (
    <PlansPanel
      tiers={PLAN_TIERS}
      current={getPlanTier(user).key}
      agentsUsed={agentsUsed}
      isOwner={!session.role || session.role === "owner"}
    />
  );
}
