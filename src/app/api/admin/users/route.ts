import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listAllUsers, listAllAgents, listAllContacts, listAllCalls, listAllAppointments,
  listWorkspacesFor, updateUser,
} from "@/lib/db";
import { isPlatformAdmin } from "@/lib/admin";
import { getPlanTier, PLAN_TIERS, type PlanTierKey } from "@/lib/plans";

// Platform-admin oversight of every tenant workspace. Returns one row per
// OWNER account (clinics), with plan, credit usage, and content counts. No
// secrets (passwords, tokens, card numbers) are ever included.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPlatformAdmin(session.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [users, agents, contacts, calls, appts] = await Promise.all([
    listAllUsers(), listAllAgents(), listAllContacts(), listAllCalls(), listAllAppointments(),
  ]);

  const countBy = <T extends { userId: string }>(rows: T[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.userId, (m.get(r.userId) ?? 0) + 1);
    return m;
  };
  const agentC = countBy(agents), contactC = countBy(contacts), apptC = countBy(appts);

  // Minutes used this month per user, from the call log.
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const minutesUsed = new Map<string, number>();
  const callC = new Map<string, number>();
  for (const c of calls) {
    callC.set(c.userId, (callC.get(c.userId) ?? 0) + 1);
    if (c.startedAt >= monthStart.toISOString()) {
      minutesUsed.set(c.userId, (minutesUsed.get(c.userId) ?? 0) + (c.durationSec || 0) / 60);
    }
  }

  const owners = users.filter((u) => !u.ownerId); // top-level tenant accounts
  const memberCount = new Map<string, number>();
  for (const u of users) if (u.ownerId && !u.isWorkspace) memberCount.set(u.ownerId, (memberCount.get(u.ownerId) ?? 0) + 1);

  const rows = owners
    .map((u) => {
      const plan = getPlanTier(u);
      const topup = u.billing?.topupMinutes ?? 0;
      const total = plan.limits.minutes + topup;
      const used = Math.round((minutesUsed.get(u.id) ?? 0) * 10) / 10;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        company: u.company,
        createdAt: u.createdAt,
        emailVerified: u.emailVerified ?? false,
        plan: plan.key,
        planName: plan.name,
        planPriceAED: plan.priceAED,
        minutesUsed: used,
        minutesTotal: total,
        minutesPct: total ? Math.min(100, Math.round((used / total) * 100)) : 0,
        agents: agentC.get(u.id) ?? 0,
        contacts: contactC.get(u.id) ?? 0,
        appointments: apptC.get(u.id) ?? 0,
        calls: callC.get(u.id) ?? 0,
        members: (memberCount.get(u.id) ?? 0) + 1,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const mrrAED = rows.reduce((s, r) => s + r.planPriceAED, 0);
  return NextResponse.json({
    tenants: rows,
    tiers: PLAN_TIERS.map((t) => ({ key: t.key, name: t.name, priceAED: t.priceAED })),
    totals: {
      tenants: rows.length,
      mrrAED,
      minutesUsed: Math.round(rows.reduce((s, r) => s + r.minutesUsed, 0)),
      calls: rows.reduce((s, r) => s + r.calls, 0),
      appointments: rows.reduce((s, r) => s + r.appointments, 0),
    },
  });
}

// Admin changes a tenant's plan.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPlatformAdmin(session.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const userId = String(body?.userId ?? "");
  const tier = String(body?.tier ?? "") as PlanTierKey;
  if (!userId || !PLAN_TIERS.some((p) => p.key === tier)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  // Apply to the tenant and all its workspaces.
  const { workspaces } = await listWorkspacesFor(userId);
  await Promise.all(workspaces.map((w) => updateUser(w.id, { planTier: tier })));
  return NextResponse.json({ ok: true });
}
