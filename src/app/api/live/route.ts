// Live-call feed for the monitoring console — REAL data from Vapi.
//
// Returns the calls Vapi currently has on the line for this workspace's
// agents (queued / ringing / in-progress / forwarding). No simulated or
// sample content: when nothing is live, the list is empty. Each call carries
// a monitor listen URL (Vapi's live-audio WebSocket) when one is available.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listAgents } from "@/lib/db";
import { listActiveVapiCalls, vapiConfigured } from "@/lib/vapi";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!vapiConfigured()) {
    return NextResponse.json({ calls: [], configured: false, at: new Date().toISOString() });
  }

  const agents = await listAgents(session.userId);
  const byAssistant = new Map(
    agents.filter((a) => a.vapiAssistantId).map((a) => [a.vapiAssistantId as string, a])
  );

  const active = await listActiveVapiCalls();
  const now = Date.now();

  // Only surface calls handled by THIS workspace's agents.
  const calls = active
    .filter((c) => c.assistantId && byAssistant.has(c.assistantId))
    .map((c) => {
      const agent = byAssistant.get(c.assistantId as string)!;
      const startIso = c.startedAt ?? c.createdAt;
      const elapsedSec = startIso
        ? Math.max(0, Math.floor((now - Date.parse(startIso)) / 1000))
        : 0;
      return {
        id: c.id,
        agentId: agent.id,
        agentName: agent.name,
        callerNumber: c.customerNumber ?? "Unknown",
        elapsedSec,
        status: c.status,
        canListen: Boolean(c.listenUrl),
      };
    });

  return NextResponse.json({ calls, configured: true, at: new Date().toISOString() });
}
