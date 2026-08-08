import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findAgent, updateAgent } from "@/lib/db";
import { syncAgentToVapi, vapiConfigured } from "@/lib/vapi";
import { buildKnowledgeText } from "@/lib/knowledge";

// Sync an agent to Vapi on demand (used by the Test Agent panel so agents
// created before Vapi was configured can still be voice-tested).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const agent = await findAgent(session.userId, id);
  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  if (!vapiConfigured()) {
    return NextResponse.json({
      configured: false,
      vapiAssistantId: null,
      error: "VAPI_API_KEY isn't set on the server.",
    });
  }

  try {
    const knowledge = await buildKnowledgeText(session.userId, agent.knowledgeBaseIds);
    const assistantId = await syncAgentToVapi(agent, knowledge);
    if (assistantId && assistantId !== agent.vapiAssistantId) {
      await updateAgent(session.userId, id, { vapiAssistantId: assistantId });
    }
    return NextResponse.json({ configured: true, vapiAssistantId: assistantId });
  } catch (e) {
    console.error("On-demand Vapi sync failed:", e);
    return NextResponse.json(
      { configured: true, vapiAssistantId: agent.vapiAssistantId ?? null, error: (e as Error).message },
      { status: 502 }
    );
  }
}
