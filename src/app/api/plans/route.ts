import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findDataOwner, listAgents, listWorkspacesFor, updateUser } from "@/lib/db";
import { PLAN_TIERS, getPlanTier, type PlanTierKey } from "@/lib/plans";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await findDataOwner(session.userId);
  const current = getPlanTier(user);
  const agentsUsed = (await listAgents(session.userId)).length;
  return NextResponse.json({ tiers: PLAN_TIERS, current: current.key, agentsUsed });
}

// Change subscription tier. Real charging arrives with Stripe; this updates
// the workspace's entitlements immediately.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role && session.role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can change the plan." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const tier = String(body?.tier ?? "") as PlanTierKey;
  if (!PLAN_TIERS.some((p) => p.key === tier)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  // Apply to the root account and propagate to all its workspaces so the whole
  // account shares one subscription.
  const owner = await findDataOwner(session.userId);
  const rootId = owner?.id ?? session.ownerId ?? session.userId;
  const { workspaces } = await listWorkspacesFor(rootId);
  await Promise.all(workspaces.map((w) => updateUser(w.id, { planTier: tier })));
  return NextResponse.json({ ok: true, current: tier });
}
