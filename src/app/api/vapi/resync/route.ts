import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listAgents, updateAgent } from "@/lib/db";
import { syncAgentToVapi, vapiConfigured } from "@/lib/vapi";
import { buildKnowledgeText } from "@/lib/knowledge";

// Re-push every agent to Vapi. Use this after changing the site domain so each
// assistant's webhook (server.url) and tool callback URLs point at the CURRENT
// domain — otherwise Vapi keeps calling the old address and calls/tools break.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!vapiConfigured()) {
    return NextResponse.json({ error: "The voice pipeline isn't connected." }, { status: 400 });
  }

  const agents = await listAgents(session.userId);
  let synced = 0;
  const failures: string[] = [];
  for (const agent of agents) {
    try {
      const knowledge = await buildKnowledgeText(session.userId, agent.knowledgeBaseIds);
      const id = await syncAgentToVapi(agent, knowledge);
      if (id) {
        if (id !== agent.vapiAssistantId) await updateAgent(session.userId, agent.id, { vapiAssistantId: id });
        synced++;
      }
    } catch (e) {
      failures.push(`${agent.name}: ${(e as Error).message.slice(0, 120)}`);
    }
  }

  return NextResponse.json({ synced, total: agents.length, failures });
}
